var exp = require("express");
var app = exp();
var prt = 3880;
var path = require('path');

var redis = require("redis");
var client = redis.createClient();

var bp = require('body-parser');
var session = require('express-session');
var sess = { user: null, secret: "IHAVENOKEY" };
var bcrypt = require('bcrypt');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var _ = require('lodash');

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var url = 'mongodb://127.0.0.1:27017/chat';
var dbs;

const crypto = require('crypto');

MongoClient.connect(url, function (err, db) {
    if (err) {
        console.log('unable to connect to db', err);
    } else {
        dbs = db;
        db.createCollection("users");
        db.createCollection("messages");
        db.collection("users").createIndex({ username: 1 }, { unique: true });
        db.collection("users").createIndex({ ident: 1 });
    }
});

app.use(bp.urlencoded({ extended: true }));
app.use(session(sess));
app.use(exp.static('assets'))

console.log("App listening on port " + prt);

http.listen(prt, function () {
    console.log("App listening on port " + prt);
});

var sockets = {};
var user_socket_ids = {};

app.get('/fetch_username', function (req, res) {
    sess = req.session;
    if (sess.user != null) {
        res.send(sess.user);
    }
    return;
});
app.get('/api/messages/:username', function (req, res) {
    sess = req.session;

    var usr = req.params.username;
    var aut = sess.user;
    console.log(req.params);
    console.log(aut);


    var collection = dbs.collection('messages');
    var query = {
        "$and":
        [
            {
                "from":
                {
                    "$in": [usr, aut]
                }
            },
            {
                "to": {
                    "$in": [usr, aut]
                }
            }
        ]
    }
    var k = collection.find(query).toArray(function (err, result) {
        if (!err) {
            res.send(result);
            return;
        }
    });
});

app.get('/api/online', function (req, res) {
    var k = [];
    res.json(_.keys(user_socket_ids));
    res.end();
})

io.on('connection', function (socket) {
    sockets[socket.id] = socket;
    socket.broadcast.emit('update_users');
    socket.on('disconnect', function () {
        console.log('user disconnected');
        socket.broadcast.emit('update_users');
    });
    socket.on('login', function (username) {
        console.log('adding user to list')
        user_socket_ids[username] = socket.id;
        socket.username = username;
    });

    socket.on('message', function (user, msg) {

        var collection = dbs.collection('messages');
        const hash = crypto.createHash('sha256');

        hash.on('readable', () => {
            var data = hash.read();
            if (data) {
                var idd = data.toString('hex');
                collection.insert({ from: socket.username, to: user, message: msg, ident: idd }, function (err, result) {
                    console.log("inserted " + result);
                });
            }
        });
        var sorted = _.sortBy([socket.username, user]).toString();
        console.log(sorted);
        hash.write(_.sortBy([socket.username, user]).toString());
        hash.end();

        socket.broadcast.to(user_socket_ids[user]).emit("message", msg, socket.username);
    });
});

app.get('/api/admin/messages/:u/:x', function (req, res) {
    sess = req.session;
    if (!sess.admin) {
        return;
    }
    var u = req.params.u;
    var x = req.params.x;

    var collection = dbs.collection('messages');
    var query = {
        "$and":
        [
            {
                "from":
                {
                    "$in": [u, x]
                }
            },
            {
                "to": {
                    "$in": [u, x]
                }
            }
        ]
    }
    var k = collection.find(query).toArray(function (err, result) {
        if (!err) {
            res.send(result);
            return;
        }
    });
});

app.get('/api/admin/download/:u/:x', function (req, res) {
    sess = req.session;
    if (!sess.admin) {
        return;
    }
    var u = req.params.u;
    var x = req.params.x;

    var collection = dbs.collection('messages');
    var query = {
        "$and":
        [
            {
                "from":
                {
                    "$in": [u, x]
                }
            },
            {
                "to": {
                    "$in": [u, x]
                }
            }
        ]
    }
    var k = collection.find(query, { "_id": 0, "from": 1, "to": 1, "message": 1 }).toArray(function (err, result) {
        if (!err) {
            res.set("Content-Disposition", "attachment;filename=" + u + "-" + x + ".json");
            res.set("Content-Type", "application/force-download");
            res.send(result);
            return;
        }
    });
});

var lump_messages = [];
function lumpMessages(err, result, l, x) {
    if (!err) {
        lump_messages.push([result[0].to, result[0].from])
        l(x);
    }
}

app.get('/api/admin/messageList', function (req, res) {
    if (!sess.admin) {
        return;
    }
    sess = req.session;

    lump_messages = [];
    var lump_count = 0;
    var convo_list = [];

    var collection = dbs.collection('messages');

    var lump_complete = function (lump_total) {
        lump_count++;
        if (lump_count == lump_total) {
            res.send(lump_messages);
        }
    };

    collection.distinct('ident', function (err, docs) {
        var x = docs.length;

        for (v in docs) {
            var query = { ident: docs[v] }
            var k = collection.find(query).toArray(function (err, result) {
                lumpMessages(err, result, lump_complete, x, lump_count);
            });


        }
    });

});


app.get("/", function (req, res) {
    sess = req.session;
    if (sess.user != null) {
        if (sess.admin) {
            res.sendFile("html/index_admin.html", { root: path.join(__dirname, 'assets') });
        } else {
            res.sendFile("html/index.html", { root: path.join(__dirname, 'assets') });
        }
        return;
    } else {
        res.redirect("/login");
        return;
    }
});

app.get('/register', function (req, res) {
    res.sendFile("html/register.html", { root: path.join(__dirname, 'assets') });
});

app.post('/register', function (req, res, next) {
    var user = {
        username: req.body.username,
        pass: req.body.pass
    };

    sess = req.session;
    const nSalt = 10;
    bcrypt.hash(user.pass, nSalt, function (err, hash) {
        var collection = dbs.collection('users');
        collection.insert({ username: user.username, password: hash, admin: 0 }, function (err, result) {
            if (!err) {
                sess.user = user.username;
                res.redirect("/");
                return;
            } else {
                next("error registering");
            }
        });

    });


});

app.get('/login', function (req, res) {
    res.sendFile("html/login.html", { root: path.join(__dirname, 'assets') });
});

app.post('/login', function (req, res, next) {
    sess = req.session;
    var user = req.body.username;
    var pass = req.body.pass;
    var cb = function (err, result) {
        if (!err) {
            bcrypt.compare(pass, result[0]['password'], function (err, pasr) {
                if (!pasr) {
                    res.redirect("/login");
                    return;
                } else {
                    sess.user = result[0].username;
                    sess.admin = result[0].admin;
                    res.redirect("/");
                    return;
                }
            });
        }
    }
    var collection = dbs.collection("users");
    var query = { "username": user }
    var k = collection.find(query).toArray(function (err, result) {
        cb(err, result);
    });
});

app.get('/logout', function (req, res) {
    req.session.user = null;
});