var username = "";


$.get('/fetch_username', function (data) {
    username = data;
})

function loadOnline() {
    return $.get('/api/online', 'json');
}

function loadAdminConvos() {
    return $.get('/api/admin/messageList', 'json');
}

function fetchMessages(user) {
    return $.get('/api/messages/' + user, 'json');
}

function fetchMessageAdmin(u, x) {
    return $.get('/api/admin/messages/' + u + '/' + x, 'json');
}

var dq = document.querySelector;

function clickUser(ex) {
    $("#selected-user").html(ex.getAttribute("data-username"));
    $('.online-user[data-username="' + ex.getAttribute("data-username") + '"]').removeClass("msga");
    $('#messages').html("");
    $('.btn-send').attr("disabled", false);
    $('.btn-down').attr("disabled", true);

    messages = fetchMessages(ex.getAttribute("data-username"));

    messages.then(function (data) {
        for (var r in data) {
            $('#messages').append($('<li>').text(data[r]['from'] + ": " + data[r]['message']));
        }
        $(".container").scrollTop($(".container")[0].scrollHeight);
    });
}

function downloadChat() {
    var x = $("#selected-user").text();
    x = x.split("+");
    window.open("/api/admin/download/" + x[0] + "/" + x[1], '_blank');
}

function clickUserAdmin(ex) {
    $("#selected-user").html(ex.getAttribute("data-username-u") + "+" + ex.getAttribute("data-username-x"));
    $('#messages').html("");
    $('.btn-send').attr("disabled", true);
    $('.btn-down').attr("disabled", false);
    messages = fetchMessageAdmin(ex.getAttribute("data-username-u"), ex.getAttribute("data-username-x"));

    messages.then(function (data) {
        for (var r in data) {
            $('#messages').append($('<li>').text(data[r]['from'] + ": " + data[r]['message']));
        }
    });
}

socket.on('connect', function () {
    var j = loadOnline();
    j.then(function (data) {
        if (data.length > 0) {
            $(".online-users").html("");
        }
        for (var v in data) {
            if (data[v] != username) {
                $(".online-users").append('<div class="online-user" onClick="clickUser(this)" data-username="' + data[v] + '">' + data[v] + '</div>');
            }
        }
    });

    var u = loadAdminConvos();
    u.then(function (data) {
        if (data.length > 0) {
            $(".admin-users").html("");
        }
        for (var y in data) {
            $(".admin-users").append('<li class="admin-user" onClick="clickUserAdmin(this)" data-username-x="' + data[y][0] + '" data-username-u="' + data[y][1] + '">' + data[y][0] + "+" + data[y][1] + '</li>');
        }
    });


    socket.emit('login', username);
    socket.on('update_users', function () {
        var j = loadOnline();
        j.then(function (data) {
            if (data.length > 0) {
                $(".online-users").html("");
            } else {
                $(".online-users").html("No online users");
            }
            for (var v in data) {
                if (data[v] != username) {
                    $(".online-users").append('<div class="online-user" onClick="clickUser(this)" data-username="' + data[v] + '">' + data[v] + '</div>');
                }
            }
        });
    });
    socket.on('message', function (msg) {
        socket.emit("message", dq("#selected-user"), msg)
    });
});