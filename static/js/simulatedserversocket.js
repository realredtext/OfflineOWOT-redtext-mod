USER_LEVEL = state.userModel.is_operator?3:state.userModel.is_superuser?2:state.userModel.is_staff?1:0;
WORLD_LEVEL = state.userModel.is_owner?2:state.userModel.is_member?1:0;            

function setUserLevel(value) {
    if(value < 0 || value > 3) throw new Error("Level is not within bounds! (0-3)");
    
    USER_LEVEL = value;
    state.userModel.is_operator = value === 3;
    state.userModel.is_superuser = value === 2 || value === 3;
    state.userModel.is_staff = value === 1 || value === 2 || value === 3;
    
    let caption = state.userModel.is_operator?"Operator":state.userModel.is_superuser?"Administrator":state.userModel.is_staff?"Staff":"Normal"
    
    return `User permission set to ${value} (${caption})`;
};
            
function setWorldLevel(value /*owner: 2, member: 1, public: 0*/) {
    if(value < 0 || value > 2) throw new Error("World permission level is not valid!");
    
    WORLD_LEVEL = value;
    state.userModel.is_owner = value === 2;
    state.userModel.is_member = state.userModel.is_owner || value === 1;
    
    let levelCaption = WORLD_LEVEL==2?"Owner":WORLD_LEVEL==1?"Member":"Public";
    return `World permission set to ${value} (${levelCaption})`;
};

var editLengthLimit = 512;
var superuserELL = 1280;

var lastChatDate = Date.now();
var lastChatID = null;
            
var start_time = Date.now();
var _time_ago = ["millisecond", "second", "minute", "hour", "day", "month", "year"];
function uptime(custom_ms_ago) {
	// (milliseconds ago)
	var difference = custom_ms_ago || (Date.now() - start_time);
	var milliseconds_ago = difference;
	var _data = _time_ago[0];
	var show_minutes = true; // EG: ... and 20 minutes
	var divided = 1;
	if(milliseconds_ago >= 30067200000) {
		_data = _time_ago[6];
		divided = 30067200000;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else if(milliseconds_ago >= 2505600000) {
		_data = _time_ago[5];
		divided = 2505600000;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else if(milliseconds_ago >= 86400000) {
		_data = _time_ago[4];
		divided = 86400000;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else if(milliseconds_ago >= 3600000) {
		_data = _time_ago[3];
		divided = 3600000;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else if(milliseconds_ago >= 60000) {
		_data = _time_ago[2];
		divided = 60000;
		show_minutes = false;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else if(milliseconds_ago >= 1000) {
		_data = _time_ago[1];
		divided = 1000;
		show_minutes = false;
		milliseconds_ago = Math.floor(milliseconds_ago / divided);
	} else {
		show_minutes = false;
	}
	if(milliseconds_ago !== 1) {
		_data += "s";
	}
	var extra = "";
	if(show_minutes) {
		var t_difference = difference;
		t_difference -= divided;
		if(t_difference > 0) {
			t_difference %= divided;
			t_difference = Math.floor(t_difference / 60000);
			if(t_difference > 0) {
				extra = " and " + t_difference + " minute";
				if(t_difference != 1) extra += "s";
			}
		}
	}
	return milliseconds_ago + " " + _data + extra;
};

function SimulatedMonitorSocket() {
    if(USER_LEVEL < 2) return;
    var top = this;
    this.active = true;
    this.onmessage = (string) => {
        console.log(string);
    };
    
    this.close = () => {
        top.onmessage = undefined;
        top.active = false;
        console.log("Monitor connection has been closed.");
    };
    this.onconnect = () => {
        console.log("Monitor connection established.");
    };
    this.onconnect();
    this.reconnect = () => {
        top.onmessage = (string) => {
            console.log(string);
        };
        top.active = true;
        console.log("Monitor connection re-established.");
    };
    
    return this;
};
		
// (EXT)
var tile_database = {};

function SimulatedServerSocket(monitorConnection=true /*bool*/) {
	var self = this;
	this.cli_id = Math.floor(Math.random() * 10000);
	this.cli_channel = "";
	this.readyState = 0;
	for(var i = 0; i < 14; i++) {
		this.cli_channel += "0123456789abcdef"[Math.floor(Math.random() * 16)];
	};
    this.info = `[${self.cli_channel}, ${self.cli_id}]`
    if(USER_LEVEL > 1 && monitorConnection) {
        self.loadMonitor = new SimulatedMonitorSocket();
        self.loadMonitor.onmessage = (data) => {console.log(data)};
    };
    this.closeMonitorConn = () => {
        self.loadMonitor.close();
    };
	this.send = function(data) {
		setTimeout(function() {
			if(data == "2::@") {
                var time = Date.now();
				self.onmessage({
					data: JSON.stringify({
						kind: "ping",
						result: "pong",
						time: true
					})
				});
                if(USER_LEVEL > 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info}: sent 'ping' on ${create_date(time)}`);
                    };
                }
				return;
			}
			data = JSON.parse(data);
			if(data.kind == "fetch") {
				var fr = data.fetchRectangles;
				var resp = {
					kind: "fetch",
					tiles: {}
				};
				for(var i = 0; i < fr.length; i++) {
					var rect = fr[i];
					var x1 = rect.minX;
					var y1 = rect.minY;
					var x2 = rect.maxX;
					var y2 = rect.maxY;
                    			var yLength = y2 - y1;
                    			var xLength = x2 - x1;
                    			if(xLength * yLength >= 100000) return; //no lag here
					for(var y = y1; y <= y2; y++) {
						for(var x = x1; x <= x2; x++) {
							var tile = tile_database[`${y},${x}`];
							if(!tile) tile = null;
							resp.tiles[`${y},${x}`] = tile;
						}
					}
				}
				self.onmessage({
					data: JSON.stringify(resp)
				});
			}
			if(data.kind == "write") {
				var edits = data.edits;
                		if(((edits.length > editLengthLimit) && USER_LEVEL < 2) || ((edits.length > superuserELL) && USER_LEVEL >= 2)) return;
				var editedTiles = {};
				var accepted = [];
				for(var i = 0; i < edits.length; i++) {
					var edit = edits[i];
					var tileY = edit[0];
					var tileX = edit[1];
					var charY = edit[2];
					var charX = edit[3];
					var time = edit[4];
					var char = edit[5];
					var id = edit[6];
					var color = edit[7];
					var tile = tile_database[tileY + "," + tileX];
					if(!tile) {
						tile_database[tileY + "," + tileX] = {
							content: " ".repeat(128),
							properties: {
								cell_props: {},
								writability: null
							}
						};
						tile = tile_database[tileY + "," + tileX];
					}
					if(tile.properties.cell_props[charY]) {
						if(tile.properties.cell_props[charY][charX]) {
							tile.properties.cell_props[charY][charX] = {};
						}
					}
					editedTiles[tileY + "," + tileX] = 1;
					var con = advancedSplit(tile.content);
					con[charY * 16 + charX] = char;
					tile.content = con.join("");
					if(color) {
						if(!tile.properties.color) {
							tile.properties.color = new Array(128).fill(0);
						}
						tile.properties.color[charY * 16 + charX] = color;
					}
					accepted.push(id);
                    if(USER_LEVEL > 1) {
                        if(self.loadMonitor.active) {
                            self.loadMonitor.onmessage(`${self.info}: sent 'write' on world '${state.worldModel.name||`(main)`}' with edits [${edit.join(", ")}] on ${create_date(time)}`);
                        };
                    }
				}
				var dataResp = {
					channel: self.cli_channel,
					kind: "tileUpdate",
					source: "write",
					tiles: {}
				};
				for(var i in editedTiles) {
					dataResp.tiles[i] = tile_database[i];
				}
				self.onmessage({
					data: JSON.stringify(dataResp)
				});
				self.onmessage({
					data: JSON.stringify({
						accepted: accepted,
						rejected: {},
						kind: "write"
					})
				});
			}
			if(data.kind == "link") {
				var ldata = data.data;
				var type = data.type;
				var tileX = ldata.tileX;
				var tileY = ldata.tileY;
				var charX = ldata.charX;
				var charY = ldata.charY;
				var url = ldata.url;
				var link_tileX = ldata.link_tileX;
				var link_tileY = ldata.link_tileY;
				var tile = tile_database[tileY + "," + tileX];
				if(!tile) {
					tile_database[tileY + "," + tileX] = {
						content: " ".repeat(128),
						properties: {
							cell_props: {},
							writability: null
						}
					};
					tile = tile_database[tileY + "," + tileX];
				}
				var cell_props = tile.properties.cell_props;
				if(!cell_props[charY]) {
					cell_props[charY] = {};
				}
				if(!cell_props[charY][charX]) {
					cell_props[charY][charX] = {};
				}
				cell_props[charY][charX] = {
					link: {
						type: type
					}
				};
				var lobj = cell_props[charY][charX].link;
				if(type == "url") {
					lobj.url = url;
				}
				if(type == "coord") {
					lobj.link_tileX = link_tileX;
					lobj.link_tileY = link_tileY;
				}
				self.onmessage({
					data: JSON.stringify({
						channel: self.cli_channel,
						kind: "tileUpdate",
						source: "write",
						tiles: {
							[tileY + "," + tileX]: tile
						}
					})
				});
                var prefix = type=="url"?"URL":"coords";
                var content = type=="url"?url:[link_tileX, link_tileY].join(" , ");
                if(USER_LEVEL < 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info} sent 'link' on world ${state.worldModel.name||`(main)`} to ${prefix}: ${content} (char ${charX}, ${charY} of tile ${tileX}, ${tileY})`);
                    };
                };
 			}
			if(data.kind == "cmd_opt") {
				w.broadcastReceive(1);
			}
			if(data.kind == "cmd") {
				var time = Date.now();
				var msg = data.msg;
				if(USER_LEVEL < 2) msg = msg.slice(0, 2048);
				var includeUsername = data.include_username;
				var sender = self.cli_channel;
				var username;
				if(includeUsername) {
					username = state.userModel.username;
				};
				var msgObj = {
					kind: "cmd",
					source: "cmd",
					msg: msg
				};
				
				if(includeUsername) {
					msgObj.username = username;
				}
				self.onmessage({
					data: JSON.stringify(msgObj)
				});
				
				if(USER_LEVEL > 1) {
					if(self.loadMonitor.active) {
						self.loadMonitor.onmessage(`${self.info}: ${includeUsername?username:``} sent message "cmd" with data \"${msg}\" at ${create_date(time)}`);
					}
				}
			}
            if(data.kind == "lock_tile") {
    			if(USER_LEVEL < 2 || WORLD_LEVEL < 2) return; 
    			var tileX = data.tileX;
    			var tileY = data.tileY;
    			var charX = data.charX;
    			var charY = data.charY;
    			var precise = data.precise;
    
    			var tile = tile_database[tileY+","+tileX] || tiles[tileY+","+tileX];
    			if(precise) {
        			var pchardata = tile.properties.char
        			if(pchardata) {
            			pchardata = pchardata.split(",").map(Number);
        			} else {
            			pchardata = new Array(128).fill(null);
        			};
        			pchardata[(charY * 16) + charX] = -1;
        			tile.properties.char = pchardata.join(",");
    			} else {
        			delete tile.properties.char;
        			tile.properties.writability = -1;
    			};
    			self.onmessage({
					data: JSON.stringify({
						channel: self.cli_channel,
						kind: "tileUpdate",
						source: "write",
						tiles: {
							[tileY + "," + tileX]: tile
						}
					})
				});
				
				if(USER_LEVEL > 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info}: sent "lock_tile" on world '${state.worldModel.name||`(main)`}' on tile ${tileX}, ${tileY} {precise: ${precise||false}${precise?`, on char ${charX}, ${charY}`:``}}`);
                    };
                }
			};
			if(data.kind == "protect") {
				var pdata = data.data;
				var action = data.action;
				var tileX = pdata.tileX;
				var tileY = pdata.tileY;
				var charX = pdata.charX;
				var charY = pdata.charY;
				var precise = pdata.precise;
				var type = pdata.type;
				var tile = tile_database[tileY + "," + tileX];
				if(!tile) {
					tile_database[tileY + "," + tileX] = {
						content: " ".repeat(128),
						properties: {
							cell_props: {},
							writability: null
						}
					};
					tile = tile_database[tileY + "," + tileX];
				}
				if(precise) {
					var pchardata = tile.properties.char;
					if(pchardata) {
						pchardata = decodeCharProt(pchardata);
					} else {
						pchardata = new Array(128).fill(null);
					}
					if(action == "protect") {
						var protVal = null;
						if(type == "owner-only" && (USER_LEVEL >= 2 || WORLD_LEVEL == 2)) {
							protVal = 2;
						} else if(type == "member-only" && (USER_LEVEL >= 1 || WORLD_LEVEL >= 1)) {
							protVal = 1;
						} else if(type == "public") {
							protVal = 0;
						}
						pchardata[charY * 16 + charX] = protVal;
					} else if(action == "unprotect") {
						if(tile.properties.writability == null) {
							pchardata[charY * 16 + charX] = null;
						} else {
							for(var a = 0; a < pchardata.length; a++) {
								if(pchardata[a] == null) {
									pchardata[a] = tile.properties.writability;
								}
							}
							tile.properties.writability = null;
							pchardata[charY * 16 + charX] = null;
						}
					}
					tile.properties.char = encodeCharProt(pchardata);
				} else {
					delete tile.properties.char;
					if(action == "protect") {
                        let ownerPerms = WORLD_LEVEL == 2 || USER_LEVEL >= 2;
                        let memberPerms = WORLD_LEVEL >= 1 || USER_LEVEL >= 1;
						if(type == "owner-only" && ownerPerms) {
							tile.properties.writability = 2;
						} else if(type == "member-only" && memberPerms && (tile.properties.writability !== 2 || tile.properties.writability !== -1)) {
							tile.properties.writability = 1;
						} else if(type == "public") {
							tile.properties.writability = 0;
						}
					} else if(action == "unprotect") {
						tile.properties.writability = null;
					}
				}
				self.onmessage({
					data: JSON.stringify({
						channel: self.cli_channel,
						kind: "tileUpdate",
						source: "write",
						tiles: {
							[tileY + "," + tileX]: tile
						}
					})
				});
                if(USER_LEVEL > 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info}: sent "protect" on world '${state.worldModel.name||`(main)`}' on tile ${tileX}, ${tileY} {precise: ${precise||false}${precise?`, on char ${charX}, ${charY}`:``}}`);
                    };
                }
			}
			if(data.kind == "clear_tile") {
                var char = data.char || " ";
                var clearProt = data.clearProt;
                var canClear = USER_LEVEL >= 2 || WORLD_LEVEL == 2;
                if(!canClear) return;
				var tileX = data.tileX;
				var tileY = data.tileY;
				var tile = tiles[tileY + "," + tileX];
				if(!tile) return;
                if(tile.properties.writability === -1) return;
                if(clearProt) tile.properties.writability = 0;
				tile.content = char.repeat(128);
				tile.properties.cell_props = {};
				self.onmessage({
					data: JSON.stringify({
						kind: "tileUpdate",
						source: "write",
						tiles: {
							[tileY + "," + tileX]: tile
						}
					})
				});
                if(USER_LEVEL > 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info}: sent "clear_tile" on world '${state.worldModel.name||`(main)`}' {X: ${tileX}, Y: ${tileY}, cleared protection: ${clearProt}}`);
                    };
                };
			}
			if(data.kind == "chat") {
				var msg = data.message;
				var time = Date.now();
                var isSpamming = (time - lastChatDate <= 500) && self.cli_id == lastChatID;
				if(isSpamming && USER_LEVEL == 0) {
					serverChatResponse("You are chatting too fast");
                    lastChatDate = time;
                    lastChatID = self.cli_id;
					return;
				};
				lastChatID = self.cli_id;
				lastChatDate = time;
                
                if(USER_LEVEL == 0) {
                    msg = msg.substring(0, 400);
                } else {
                    msg = msg.substring(0, 4000);
                }
				self.onmessage({
					data: JSON.stringify({
						nickname: data.nickname,
						realUsername: state.userModel.username,
						id: self.cli_id,
						message: data.message,
						registered: state.userModel.authenticated,
						location: data.location,
						op: USER_LEVEL === 3,
						admin: USER_LEVEL >= 2,
						staff: USER_LEVEL >= 1,
						color: data.color,
						date: time,
						kind: "chat"
					})
				});
                 if(USER_LEVEL > 1) {
                    if(self.loadMonitor.active) {
                        self.loadMonitor.onmessage(`${self.info}: sent message "chat" on world ${state.worldModel.name||`(main)`} with message "${msg}" in ${data.location} chat.`);
                    };
                };
			};
               
		}, 1);
	}
	this.close = function() {
		this.onclose();
	}
	setTimeout(function() {
		self.readyState = WebSocket.OPEN;
		self.onopen();
		self.onmessage({
			data: JSON.stringify({
				kind: "channel",
				sender: self.cli_channel,
				id: self.cli_id,
				initial_user_count: 1
			})
		});
	}, 1);
	return this;
};
