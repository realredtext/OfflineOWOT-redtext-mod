// (EXT)
function exportWorld() {
	var filename = "export" + Date.now() + ".json"
	var down = document.createElement("a");
	down.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(tile_database)));
	down.setAttribute("download", filename);
	if (document.createEvent && "download" in down && !window.navigator.msSaveBlob) {
		var event = document.createEvent("MouseEvents");
		event.initEvent("click", true, true);
		down.dispatchEvent(event);
	} else if("download" in down && !window.navigator.msSaveBlob) {
		down.click();
	} else if(window.navigator.msSaveBlob) {
		window.navigator.msSaveBlob(new Blob([JSON.stringify(tile_database)], {type: "octet/stream"}), filename);
	}
}