import_world.onchange = function(e) {
	var files = import_world.files;
	for(var i = 0; i < files.length; i++) {
		var file = files[i];
		var fr = new FileReader();
		fr.onload = function(res) {
			var data = JSON.parse(res.target.result);
			if(Array.isArray(data)) { // world-download export
				for(var t = 0; t < data.length; t++) {
					var tile = data[t];
					var content = tile.content;
					var tileX = tile.tileX;
					var tileY = tile.tileY;
					var properties = tile.properties;
					var writability = tile.writability;
					properties = JSON.parse(properties);
					properties.writability = writability;
					tile_database[tileY + "," + tileX] = {
						content: content,
						properties: properties
					};
				}
			} else { // offlineOWOT export
				for(var tile in data) {
					tile_database[tile] = data[tile];
				}
			}
			clearTiles(true);
			w.fetchUpdates();
		}
		fr.readAsText(file);
	}
}