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
var chatEmotes           = true;
var redHighlight		 = true;
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
    elm.chatbar.maxLength = 400
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
    var exclude_commands = opts.exclude_commands || false;
    var nick = opts.nick || YourWorld.Nickname;
    var location = opts.location ? opts.location : (selectedChatTab == 0 ? "page" : "global");

    var msgLim = USER_LEVEL >= 1 ? 3030 : 400;

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
        if(client_commands[command]) {
            client_commands[command](args);
            return;
        };
        if(simulatedServerCommands[command] && USER_LEVEL >= commandPermissions[command]) {
            simulatedServerCommands[command](args);
            return;
        }
        if((!simulatedServerCommands[command] && !client_commands[command] && command != "help") || USER_LEVEL < commandPermissions[command]) {
                serverChatResponse(`Invalid command: /${command}`);
                return;
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

var muteList = [];

var commandPermissions = {
    channel: 1,
    stats: 0,
    whoami: 0,
    uptime: 3,
    monitor: 2,
    mute: 1,
    clearmutes: 1,
    worlds: 2,
    help: 1
};
    
var commandDescriptions = {
    channel: "Check the channel of the chat field you are in",
    stats: "Check the view count and creation date of a world",
    whoami: "Check your nickname, username, id, and permissions",
    uptime: "Check the uptime of the server",
    monitor: "Connect or disconnect from the simulated load monitor in the console (on/off)",
    mute: "Silence a user for a finite time (id, seconds)",
    clearmutes: "Clears all mutes",
    worlds: "Check the activity of the 1000 most viewed worlds",
    help: "Gives a list of available commands and their usage",
    nick: "Change your chat nickname (nick (no nick will set your nick to your username))",
    ping: "Check your connection time to the server",
    gridsize: "Change the size of characters (width x height)",
    color: "Set your canvas color (any hex color)",
    chatcolor: "Set your name's color in chat (any hex color)",
    warp: "Warp to a world you can visit (/worldname)",
    warpserver: "Change the wss address your socket is connected to (wss://somewhere.somethingsomething.com/ws/)",
    night: "Turn on night mode on the canvas"
};

var simulatedServerCommands = {
    channel: (args) => {
        let dataArr = [`Found 1 channel(s) for this world.`, `<b>Name:</b> ${selectedChatTab==0?"_":"global"}`, `<b>Desc:</b> ${selectedChatTab==0?"Front page channel":"The global channel - Users can access this channel from any page on OWOT"}`, `<b>Created:</b> (UTC) March 24, 2021, 1:32:11 PM`, "----------------", `<b>Default channel id:</b> ${selectedChatTab==0?"2":html_tag_esc("<none>")}`]
        serverChatResponse(dataArr.join("<br>"))
    },
    stats: () => {
        serverChatResponse(`Stats for world<br>Creation date: (Local time) ${state.creation_date}<br>View count: ${viewCount}`);
    },
    whoami: () => {
        let user = state.userModel;
        let yw = YourWorld;
        let levelCaption = USER_LEVEL==3?"(Operator)":USER_LEVEL==2?"(Superuser)":USER_LEVEL==1?"(Staff)":"(Normal)";
        let levelStr = `${USER_LEVEL} ${levelCaption}`;
        
        let wlCaption = WORLD_LEVEL==2?"(Owner)":WORLD_LEVEL==1?"(Member)":"(Public)";
        let wlStr = `${WORLD_LEVEL} ${wlCaption}`
        
        let list = [`Username: <b style="color: ${int_to_hexcode(localStorage.getItem("chatcolor")*1)}">${user.username}</b>`, `Nickname: ${yw.Nickname}`, `Level: ${levelStr}`, `World level: ${wlStr}`, `ID: ${socket.socket.cli_id}`];
        
        serverChatResponse(`Who am I:<br>${list.join("<br>&emsp;")}`)
    },
    uptime: () => {
        serverChatResponse(`Server uptime: ${uptime()}`);
    },
    monitor: ([value]) => {
        const values = {"on": true, "off": false};
        if(!value in values) return serverChatResponse("Type is not \"on\" or \"off\"!");
        if(value == "on" && !socket.monitor.active) {
            socket.reconnectMonitor();
            serverChatResponse("Connected to load monitor.");
        } else if(value == "off" && socket.monitor.active) {
            socket.closeMonitor();
            serverChatResponse("Disconnected from load monitor.");
        };
        
    },
    mute: (args) => {
        let canMute = USER_LEVEL !== 0 || WORLD_LEVEL === 2;
        if(!canMute) return;
        let mutedID = parseInt(args[0]);
        let muteTime = parseInt(args[1]);
        let muteFn = (e) => {
            if(e.id === muteID) e.hide = true;
        }
        
        w.events.chatmod.push(muteFn);
        muteList.push(muteFn);
        let idx = w.events.chatmod.indexOf(muteFn);
        let ml_idx = muteList.indexOf(muteFn);
        serverChatResponse(`Client muted until ${convertToDate(Date.now() + (muteTime * 1000))}`);
        
        setTimeout(()=>{w.events.chatmod.splice(idx, 1); muteList.splice(ml_idx, 1); serverChatResponse("Client unmuted")}, muteTime * 1000);
    },
    clearmutes: (args) => {
        let canClearMutes = USER_LEVEL !== 0 || WORLD_LEVEL === 2;
        if(!canClearMutes) return;
        var cnt = 0
        for(let i = 0; i < muteList.length; i++) {
            let muteFnIDX = w.events.chatmod.indexOf(muteList[i]);
            w.events.chatmod.splice(muteFnIDX, 1);
            cnt++;
        };
        serverChatResponse(`Unmuted ${cnt} client${cnt>1?"s":""}.`);
    },
    worlds: (args) => {
        if(!(USER_LEVEL >= 2)) return;
        serverChatResponse("Currently loaded worlds (top 1000):<br><div style=\"background-color: #DADADA\"><span style=\"font-family: monospace; font-size: 13px\">-> (main) [1]</span></div>")
    },
    help: () => {
        var availableCommands = [];
        for(var i in commandDescriptions) {
            if(USER_LEVEL >= commandPermissions[i] || commandPermissions[i] == undefined) {
                availableCommands.push(i);
            };
        };
        
        var commandStrings = [];
        for(var i of availableCommands) {
            commandStrings.push(`<b>${i}</b>: ${commandDescriptions[i]}`);
        };
        
        serverChatResponse(commandStrings.join("<br><br>"));
    }
};

            
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

var emoteList = {
    "403": [0, 19],
    "OHHELLNO": [19, 16],
    "aaaHD": [35, 16],
    "aha": [51, 16],
    "areyoukidding": [67, 16],
    "awesome": [83, 16],
    "awesome2": [99, 16],
    "bad": [115, 16],
    "beepboop": [131, 16],
    "bootiful": [147, 16],
    "bruh": [163, 16],
    "catthinkaaa": [179, 22],
    "chaos": [201, 16],
    "ded": [217, 16],
    "derp": [233, 16],
    "dislike": [249, 15],
    "durr": [264, 16],
    "erhb": [280, 16],
    "failwhale": [296, 35],
    "fpthinkaaa": [331, 16],
    "huh": [347, 16],
    "karp": [363, 17],
    "lenny": [380, 16],
    "like": [396, 15],
    "lol": [411, 16],
    "mad": [427, 16],
    "meh": [443, 16],
    "mmm": [459, 16],
    "neat": [475, 16],
    "no": [491, 16],
    "notcool": [507, 16],
    "oOoo": [523, 16],
    "ohno": [539, 16],
    "okthen": [555, 16],
    "omg": [571, 16],
    "ouch": [587, 16],
    "sad": [603, 16],
    "sadsmug": [619, 16],
    "scruffy": [635, 19],
    "smug": [654, 16],
    "stahp": [670, 16],
    "teef": [686, 16],
    "thinq": [702, 16],
    "thunk": [718, 16],
    "tri": [734, 17],
    "troll1": [751, 16],
    "void": [767, 16],
    "what": [783, 16],
    "yeesh": [799, 16],
    "zzz": [815, 16]
};

/*
    [type]:
    * "user"      :: registered non-renamed nick
    * "anon_nick" :: unregistered nick
    * "anon"      :: unregistered
    * "user_nick" :: registered renamed nick
*/
function addChat(chatfield, id, type, nickname, message, realUsername, op, admin, staff, color, date, dataObj) {
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
	var highlighted = false;

    if(chatLimitCombChars) {
        message = w.split(message);
        for(var i = 0; i < message.length; i++) {
            message[i] = message[i].slice(0, 5);
        }
        message = message.join("");
    }
	
	if(redHighlight && message[0] == ">" && !(":;_-".includes(message[1]))) { // exception to some emoticons
		message = message.substr(1);
		highlighted = true;
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
    };
	
	if(highlighted && !type.includes("anon")) {
		message = `<b style="background-color: #FFDDDD">&gt;${message}</b>`
	}
    
    	emote_parse: if(chatEmotes) {
		var emote_split = message.split(":");
		if(emote_split.length < 3) break emote_parse;
		var parsed = [];

		for(var i = 0; i < (emote_split.length - 1); ++i) {
			if(i % 2 == 0) { // isn't between two : chars
				parsed.push(emote_split[i]);
			} else if(emoteList.hasOwnProperty(emote_split[i])) { // good emote
				var position = emoteList[emote_split[i]];
				parsed.push("<div title=':" + emote_split[i]
					+ ":' class='chat_emote' style='background-position-x:-" + position[0]
					+ "px;width:" + position[1] + "px'></div>");
			} else { // invalid emote
				parsed.push(":" + emote_split[i] + ":");
			}
		}

		if (emote_split.length % 2 == 0) parsed.push(":")
		parsed.push(emote_split[emote_split.length - 1])
		message = parsed.join("");
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
    };
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
