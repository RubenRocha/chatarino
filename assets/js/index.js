var username = "";

$.get('/fetch_username', function (data) {
    username = data;
})

function loadOnline() {
    return $.get('/api/online', 'json');
}

function fetchMessages(user) {
    return $.get('/api/messages/' + user, 'json');
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