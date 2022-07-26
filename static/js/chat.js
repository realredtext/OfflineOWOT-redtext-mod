var selectedChatTab      = 0; // 0 is the page chat, 1 is the global chat
var chatOpen             = 0;
var chatPageUnread       = 0;
var chatGlobalUnread     = 0;
var initPageTabOpen      = false;
var initGlobalTabOpen    = false;
var chatWriteHistory     = []; // history of user's chats
var chatWriteHistoryMax  = 100; // maximum size of chat write history length
var chatWriteHistoryIdx  = -1; // location in chat write history
var serverPingTime       = 0;
var chatLimitCombChars   = true;
var chatWriteTmpBuffer   = "";
var defaultChatColor     = window.localStorage ? parseInt(localStorage.getItem("chatcolor")) : null; // 24-bit Uint

if(isNaN(defaultChatColor)) {
    defaultChatColor = null;
} else {
    if(defaultChatColor < 0) defaultChatColor = 0;
    if(defaultChatColor > 16777215) defaultChatColor = 16777215;
}

defineElements({ // elm[<name>]
    chat_window: byId("chat_window"),
    chat_open: byId("chat_open"),
    chatsend: byId("chatsend"),
    chatbar: byId("chatbar"),
    chat_close: byId("chat_close"),
    page_chatfield: byId("page_chatfield"),
    global_chatfield: byId("global_chatfield"),
    chat_page_tab: byId("chat_page_tab"),
    chat_global_tab: byId("chat_global_tab"),
    usr_online: byId("usr_online"),
    total_unread: byId("total_unread"),
    page_unread: byId("page_unread"),
    global_unread: byId("global_unread")
});

if(!USER_LEVEL) {
    elm.chatbar.maxLength = 2000
}

var canChat = Permissions.can_chat(state.userModel, state.worldModel);
if(!canChat) {
    selectedChatTab = 1;
    elm.chat_window.style.display = "none";
} else {
    elm.chat_open.style.display = "";
}

function api_chat_send(message, opts) {
    if(!message) return;
    message = message.replace(/\uFDFD/g, "");
    if(!opts) opts = {};
    var exclude_commands = opts.exclude_commands;
    var nick = opts.nick || YourWorld.Nickname;
    var location = opts.location ? opts.location : (selectedChatTab == 0 ? "page" : "global");

    var msgLim = USER_LEVEL >= 1 ? Infinity : 2000;

    message = message.trim();
    if(!message.length) return;
    message = message.slice(0, msgLim);
    chatWriteHistory.push(message);
    if(chatWriteHistory.length > chatWriteHistoryMax) {
        chatWriteHistory.shift();
    }
    chatWriteHistoryIdx = -1;
    chatWriteTmpBuffer = "";

    var chatColor;
    if(!opts.color) {
        if(!YourWorld.Color) {
            chatColor = assignColor(YourWorld.Nickname);
        } else {
            chatColor = "#" + ("00000" + YourWorld.Color.toString(16)).slice(-6);
        }
    } else {
        chatColor = opts.color;
    }

    if(!exclude_commands && message.startsWith("/")) {
        var args = message.substr(1).split(" ");
        var command = args[0].toLowerCase();
        args.shift();
        if(client_commands.hasOwnProperty(command)) {
            client_commands[command](args);
            return;
        };
        if(simulatedServerCommands.hasOwnProperty(command)) {
            simulatedServerCommands[command](args);
            return;
        if(!(command in simulatedServerCommands) && !(command in client_commands)) {
                serverChatResponse(`${command} is not a supported command!`);
                return;
            }
        }
    }
    var isCommand = false;
    if(!exclude_commands && message.startsWith("/")) {
        isCommand = true;
    }

    network.chat(message, location, nick, chatColor);

    var registered = state.userModel.authenticated;
    var username = state.userModel.username;
    var id = w.clientId;
    var nickname = YourWorld.Nickname;

    var type = chatType(registered, nickname, username);

    var op = opts.op || USER_LEVEL === 3;
    var admin = opts.admin || USER_LEVEL === 3 || USER_LEVEL === 2;
    var staff = opts.staff || USER_LEVEL === 3 || USER_LEVEL === 2 || USER_LEVEL === 1;
};

function clientChatResponse(msg) {
    addChat(null, 0, "user", "[ Client ]", msg, "Client", true, true, true, "#33f", getDate())
};
            
function serverChatResponse(msg, html=true) {
    addChat(null, 0, "user", "[ Server ]", msg, "Server", html, html, html, "#f00", getDate())
};

var simulatedServerCommands = {
    stats: (args) => {
        serverChatResponse("World stats:<br>Views: 1<br>Created on: March 24 2021, 5:32:11 PM");
    },
    whoami: (args) => {
        let user = state.userModel;
        let yw = YourWorld;
        let levelCaption = USER_LEVEL==3?"(Operator)":USER_LEVEL==2?"(Superuser)":USER_LEVEL==1?"(Staff)":"(Normal)";
        let levelStr = `${USER_LEVEL} ${levelCaption}`
        
        let list = [`Username: <b style="color: ${int_to_hexcode(localStorage.getItem("chatcolor")*1)}">${user.username}</b>`, `Nickname: ${yw.Nickname}`, `Level: ${levelStr}`, `ID: ${w.clientId}`];
        
        serverChatResponse(`Who am I:<br>${list.join("<br>&emsp;")}`)
    },
    uptime: (args) => {
        serverChatResponse(`Server uptime: ${uptime()}`);
    },
    mute: (args) => {
        if(!(USER_LEVEL >= 1)) return;
        let mutedID = parseInt(args[0]);
        let muteTime = parseInt(args[1]);
        let muteFn = (e) => {
            if(e.id === muteID) e.hide = true;
        }
        
        w.events.chatmod.push(muteFn);
        let idx = w.events.chatmod.indexOf(muteFn);
        serverChatResponse(`Client muted until ${convertToDate(Date.now() + (muteTime * 1000))}`);
        
        setTimeout(()=>{w.events.chatmod.splice(idx, 1); serverChatResponse("Client unmuted")}, muteTime * 1000)
    },
    worlds: (args) => {
        if(!(USER_LEVEL >= 2)) return;
        serverChatResponse("Top active worlds:<br><span style=\"background-color: #ddd;\">(main) [1]</span>")
    }
}
            
var client_commands = {
    nick: function (args) {
        var newDisplayName = args.join(" ");
        if(!newDisplayName) {
            newDisplayName = state.userModel.username;
        }
        var nickLim = USER_LEVEL >= 1 ? Infinity : 400;
        newDisplayName = newDisplayName.slice(0, nickLim);
        YourWorld.Nickname = newDisplayName;
        storeNickname();
        var nickChangeMsg;
        if(newDisplayName) {
            nickChangeMsg = "Set nickname to `" + newDisplayName + "`";
        } else {
            nickChangeMsg = "Nickname reset";
        }
        serverChatResponse(nickChangeMsg);
    },
    ping: () => {
        serverPingTime = getDate();
        network.ping(true);
    },
    gridsize: function (args) {
        var size = args[0];
        if(!size) size = "10x18";
        size = size.split("x");
        var width = parseInt(size[0]);
        var height = parseInt(size[1]);
        if(!width || isNaN(width) || !isFinite(width)) width = 10;
        if(!height || isNaN(height) || !isFinite(height)) height = 18;
        defaultSizes.cellW = width;
        defaultSizes.cellH = height;
        updateScaleConsts();
        for(var i in tilePixelCache) delete tilePixelCache[i];
        renderTiles(true);
        serverChatResponse(`Changed grid size to ${width}x${height}`)
    },
    color: function(args) {
        var color = args[0];
        if(!color) color = "000000";
        if(color.charAt(0) == "#") color = color.substr(1);
        if(!color) color = 0;
        YourWorld.Color = parseInt(color, 16);
        if(isNaN(color)) color = 0;
        serverChatResponse(`Changed color to ${int_to_hexcode(YourWorld.Color)}`);
    },
    chatcolor: function(args) {
        var color = args[0];
        var reset = false;
        if(!color) {
            color = "000000";
            reset = true;
        }
        if(color.charAt(0) == "#") color = color.substr(1);
        if(!color) color = 0;
        if(reset) {
            localStorage.removeItem("chatcolor");
            defaultChatColor = null;
            serverChatResponse("Chat color resst")
        } else {
            defaultChatColor = parseInt(color, 16);
            localStorage.setItem("chatcolor", defaultChatColor);
            if(isNaN(color)) color = 0;
            serverChatResponse(`Changed chatcolor to ${int_to_hexcode(localStorage.getItem("chatcolor")*1)}`)
        }
    },
    warp: function(args) {
        var address = args[0];
        if(!address) address = "";
        positionX = 0;
        positionY = 0;
        if(address.charAt(0) == "/") address = address.substr(1);
        state.worldModel.pathname = "/" + address;
        ws_path = createWsPath();
        w.changeSocket(ws_path);
        serverChatResponse(`Switching to world "${address}"`);
    },
    warpserver: function(args) {
        var address = args[0];
        if(!address) {
            ws_path = createWsPath();
        } else {
            ws_path = address;
        }
        positionX = 0;
        positionY = 0;
        w.changeSocket(ws_path);
        serverChatResponse(`Switching to server: ${ws_path}`);
    },
    night: function() {
        w.night();
    },
    day: function() {
        w.day(); // (MOD)
    }
}

function sendChat() {
    var chatText = elm.chatbar.value;
    elm.chatbar.value = "";
    var opts = {};
    if(defaultChatColor != null) {
        opts.color = "#" + ("00000" + defaultChatColor.toString(16)).slice(-6);
    }
    api_chat_send(chatText, opts);
}

function updateUnread() {
    var total = elm.total_unread;
    var page = elm.page_unread;
    var global = elm.global_unread;
    var totalCount = chatPageUnread + chatGlobalUnread;
    total.style.display = "none";
    global.style.display = "none";
    page.style.display = "none";
    if(totalCount) {
        total.style.display = "";
        total.innerText = totalCount > 99 ? "99+" : "(" + totalCount + ")";
    }
    if(chatPageUnread) {
        page.style.display = "";
        page.innerText = chatPageUnread > 99 ? "99+" : "(" + chatPageUnread + ")";
    }
    if(chatGlobalUnread) {
        global.style.display = "";
        global.innerText = chatGlobalUnread > 99 ? "99+" : "(" + chatGlobalUnread + ")";
    }
};
            
function evaluateChatfield(chatfield) {
	var field;
	if(chatfield == "page") {
		field = elm.page_chatfield;
	} else if(chatfield == "global") {
		field = elm.global_chatfield;
	} else {
		field = getChatfield();
	}
	return field;
};
            
function addUnreadChatBar(chatfield, message, checkSituation) {
	var field = evaluateChatfield(chatfield);
	if(checkSituation) {
		var maxScroll = field.scrollHeight - field.clientHeight;
		var scroll = field.scrollTop;
		var remScroll = maxScroll - scroll;
		if(chatfield == "page") {
			if(chatPageUnreadBar || selectedChatTab == 0) return;
		}
		if(chatfield == "global") {
			if(chatGlobalUnreadBar || selectedChatTab == 1) return;
		}
	}
	var msg = "New messages";
	if(message) msg = message;
	var bar = document.createElement("div");
	var barText = document.createElement("span");
	bar.className = "unread_bar";
	barText.className = "unread_bar_msg";
	barText.innerText = msg;
	bar.appendChild(barText);
	field.appendChild(bar);
	return bar;
}

function event_on_chat(data) {
    if((!chatOpen || selectedChatTab == 1) && data.location == "page") {
        chatPageUnread++;
    }
    if((!chatOpen || selectedChatTab == 0) && data.location == "global") {
        chatGlobalUnread++;
    }
    updateUnread();
    addChat(data.location, data.id, data.type,
        data.nickname, data.message, data.realUsername, data.op, data.admin, data.staff, data.color, getDate(), data.dataObj);
}

elm.chatsend.addEventListener("click", function() {
    sendChat();
});

elm.chatbar.addEventListener("keypress", function(e) {
    var keyCode = e.keyCode;
    if(keyCode == 13) { // Enter
        sendChat();
        elm.chatbar.blur();
    }
});

function moveCaretEnd(elm) {
    if(elm.selectionStart != void 0) {
        elm.selectionStart = elm.value.length;
        elm.selectionEnd = elm.value.length;
    } else if(elm.createTextRange != void 0) {
        elm.focus();
        var range = elm.createTextRange();
        range.collapse(false);
        range.select();
    }
}

elm.chatbar.addEventListener("keydown", function(e) {
    var keyCode = e.keyCode;
    // scroll through chat history that the client sent
    if(keyCode == 38) { // up
        // history modified
        if(chatWriteHistoryIdx > -1 && elm.chatbar.value != chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1]) {
            chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1] = elm.chatbar.value;
        }
        if(chatWriteHistoryIdx == -1 && elm.chatbar.value) {
            chatWriteTmpBuffer = elm.chatbar.value;
        }
        chatWriteHistoryIdx++;
        if(chatWriteHistoryIdx >= chatWriteHistory.length) chatWriteHistoryIdx = chatWriteHistory.length - 1;
        var upVal = chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1];
        if(!upVal) return;
        elm.chatbar.value = upVal;
        // pressing up will move the cursor all the way to the left by default
        e.preventDefault();
        moveCaretEnd(elm.chatbar);
    } else if(keyCode == 40) { // down
        // history modified
        if(chatWriteHistoryIdx > -1 && elm.chatbar.value != chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1]) {
            chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1] = elm.chatbar.value;
        }
        chatWriteHistoryIdx--;
        if(chatWriteHistoryIdx < -1) {
            chatWriteHistoryIdx = -1;
            return;
        }
        var str = "";
        if(chatWriteHistoryIdx != -1) {
            str = chatWriteHistory[chatWriteHistory.length - chatWriteHistoryIdx - 1];
        } else {
            if(chatWriteTmpBuffer) {
                str = chatWriteTmpBuffer;
                e.preventDefault();
                moveCaretEnd(elm.chatbar);
            }
        }
        elm.chatbar.value = str;
        e.preventDefault();
        moveCaretEnd(elm.chatbar);
    }
});

elm.chat_close.addEventListener("click", function() {
    w.emit("chatClose");
    elm.chat_window.style.display = "none";
    elm.chat_open.style.display = "";
    chatOpen = false;
});

elm.chat_open.addEventListener("click", function() {
    w.emit("chatOpen");
    elm.chat_window.style.display = "";
    elm.chat_open.style.display = "none";
    chatOpen = true;
    if(selectedChatTab == 0) {
        chatPageUnread = 0;
        updateUnread();
        if(!initPageTabOpen) {
            initPageTabOpen = true;
            elm.page_chatfield.scrollTop = elm.page_chatfield.scrollHeight;
        }
    } else {
        chatGlobalUnread = 0;
        updateUnread();
        if(!initGlobalTabOpen) {
            initGlobalTabOpen = true;
            elm.global_chatfield.scrollTop = elm.global_chatfield.scrollHeight;
        }
    }
});

elm.chat_page_tab.addEventListener("click", function() {
    elm.chat_global_tab.style.backgroundColor = "";
    elm.chat_global_tab.style.color = "";
    elm.chat_page_tab.style.backgroundColor = "#8c8c8c";
    elm.chat_page_tab.style.color = "white";

    elm.global_chatfield.style.display = "none";
    elm.page_chatfield.style.display=  "";
    selectedChatTab = 0;
    chatPageUnread = 0;
    updateUnread();
    if(!initPageTabOpen) {
        initPageTabOpen = true;
        elm.page_chatfield.scrollTop = elm.page_chatfield.scrollHeight;
    }
});

elm.chat_global_tab.addEventListener("click", function() {
    elm.chat_global_tab.style.backgroundColor = "#8c8c8c";
    elm.chat_global_tab.style.color = "white";
    elm.chat_page_tab.style.backgroundColor = "";
    elm.chat_page_tab.style.color = "";

    elm.global_chatfield.style.display = "";
    elm.page_chatfield.style.display = "none";
    selectedChatTab = 1;
    chatGlobalUnread = 0;
    updateUnread();
    if(!initGlobalTabOpen) {
        initGlobalTabOpen = true;
        elm.global_chatfield.scrollTop = elm.global_chatfield.scrollHeight;
    }
});

/*
    [type]:
    * "user"      :: registered non-renamed nick
    * "anon_nick" :: unregistered nick
    * "anon"      :: unregistered
    * "user_nick" :: registered renamed nick
*/
function addChat(chatfield, id, type="user", nickname, message, realUsername, op, admin, staff, color, date=Date.now(), dataObj) {
    if(!dataObj) dataObj = {};
    if(!nickname) nickname = "";
    if(!message) message = "";
    if(!realUsername) realUsername = "";
    if(!color) color = assignColor(nickname);
    var dateStr = "";
    if(date) dateStr = convertToDate(date);
    var field;
    if(chatfield == "page") {
        field = elm.page_chatfield;
    } else if(chatfield == "global") {
        field = elm.global_chatfield;
    } else {
        field = getChatfield();
    }
    var pm = dataObj.privateMessage;

    if(chatLimitCombChars) {
        message = w.split(message);
        for(var i = 0; i < message.length; i++) {
            message[i] = message[i].slice(0, 5);
        }
        message = message.join("");
    }

    if(!op) message = html_tag_esc(message);
    if(!op) nickname = html_tag_esc(nickname);

     // do not give the tag to [ Server ]
    var hasTagDom = (op || admin || staff || dataObj.rankName) && !(!id && op);

    var tagDom;
    var nickTitle = [];

    if(type.includes("user")) {
        nickTitle.push("ID " + id);
    }

    if(hasTagDom) {
        tagDom = document.createElement("span");
        if(dataObj.rankName) {
            tagDom.innerHTML = "(" + dataObj.rankName + ")";
            tagDom.style.color = dataObj.rankColor;
            tagDom.style.fontWeight = "bold";
            nickTitle.push(dataObj.rankName);
        } else if(op) {
            tagDom.innerHTML = "(OP)";
            tagDom.style.color = "#0033cc";
            tagDom.style.fontWeight = "bold";
            nickTitle.push("Operator");
        } else if(admin) {
            tagDom.innerHTML = "(A)";
            tagDom.style.color = "#FF0000";
            tagDom.style.fontWeight = "bold";
            nickTitle.push("Administrator");
        } else if(staff) {
            tagDom.innerHTML = "(M)";
            tagDom.style.color = "#009933";
            tagDom.style.fontWeight = "bold";
            nickTitle.push("Staff");
        }
        tagDom.innerHTML += "&nbsp;";
    }

    var idTag = "";

    var nickDom = document.createElement("a");
    nickDom.style.textDecoration = "underline";

    if(type == "user") {
        nickDom.style.color = color;
        nickDom.style.fontWeight = "bold";
        nickDom.style.pointerEvents = "default";
        if(USER_LEVEL === 3) idTag = "[" + id + "]";
    }
    if(type == "anon_nick") {
        idTag = "[*" + id + "]"
    }
    if(type == "anon") {
        idTag = "[" + id + "]"
    }
    if(type == "user_nick") {
        nickDom.style.color = color;
        nickTitle.push("Username \"" + realUsername + "\"");
        if(USER_LEVEL === 3) idTag = "[*" + id + "]";
    }

    if(USER_LEVEL === 3) {
        idTag = "<span style=\"color: black; font-weight: normal;\">" + idTag + "</span>"
    }

    if(idTag && type != "anon") idTag += "&nbsp;"; // space between id and name

    if(id == 0) {
        idTag = "";
        nickname = "<span style=\"background-color: #e2e2e2;\">" + nickname + "</span>";
    }

    nickname = idTag + nickname;

    if(dateStr) nickTitle.push("(" + dateStr + ")");

    nickDom.innerHTML = nickname + (pm == "to_me" ? "" : ":");
    if(nickTitle.length) nickDom.title = nickTitle.join("; ");

    var pmDom = null;
    if(pm) {
        pmDom = document.createElement("div");
        pmDom.style.display = "inline";
        if(pm == "to_me") {
            pmDom.innerText = " -> Me:";
        } else if(pm == "from_me") {
            pmDom.innerText = "Me -> ";
        }
    }

    var msgDom = document.createElement("span");
    msgDom.innerHTML = "&nbsp;" + message;

    var maxScroll = field.scrollHeight - field.clientHeight;
    var scroll = field.scrollTop;
    var doScrollBottom = false;
    if(maxScroll - scroll < 20) { // if scrolled at least 20 pixels above bottom
        doScrollBottom = true;
    }

    var chatGroup = document.createElement("div");
    if(!pm && hasTagDom) chatGroup.appendChild(tagDom);
    if(pmDom) {
        if(pm == "to_me") {
            if(hasTagDom) chatGroup.appendChild(tagDom);
            chatGroup.appendChild(nickDom);
            chatGroup.appendChild(pmDom);
        } else if(pm == "from_me") {
            chatGroup.appendChild(pmDom);
            if(hasTagDom) chatGroup.appendChild(tagDom);
            chatGroup.appendChild(nickDom);
        }
    } else {
        chatGroup.appendChild(nickDom);
    }
    chatGroup.appendChild(msgDom);

    field.appendChild(chatGroup);

    maxScroll = field.scrollHeight - field.clientHeight;
    if(doScrollBottom) {
        field.scrollTop = maxScroll;
    }
}

function getChatfield() {
    if(selectedChatTab == 0) {
        return elm.page_chatfield;
    } else if(selectedChatTab == 1) {
        return elm.global_chatfield;
    }
}

function updateUserCount() {
    var count = w.userCount;
    if(count == void 0) {
        elm.usr_online.innerText = "";
        return;
    }
    var unit = "user";
    var units = "users";
    var current_unit;
    if(count == 1) {
        current_unit = unit;
    } else {
        current_unit = units;
    }
    elm.usr_online.innerText = count + " " + current_unit + " online";
}

function chatType(registered, nickname, realUsername) {
    var nickMatches = (nickname + "").toUpperCase() == (realUsername + "").toUpperCase();
    if(realUsername == "[ Server ]") return "user";
    var type = "";
    if(registered && nickMatches) type = "user";
    if(registered && !nickMatches) type = "user_nick";
    if(!registered && !nickname) type = "anon";
    if(!registered && nickname) type = "anon_nick";
    return type;
}