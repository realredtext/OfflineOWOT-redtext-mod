        var atlInfo = document.createElement("label");
atlInfo.style.display = "none";
atlInfo.innerText = "Press CTRL and move your mouse around to lock tiles. " + 
    "This will lock all tiles where the mouse cursor is located.";
atlInfo.style.backgroundColor = "black";
atlInfo.style.color = "white";
atlInfo.style.position = "absolute";
atlInfo.style.left = "0px";
atlInfo.style.top = "0px";
document.body.appendChild(atlInfo);

var admlckActivated = document.createElement("label");
admlckActivated.innerText = " [ ACTIVE ]";
admlckActivated.style.backgroundColor = "black";
admlckActivated.style.color = "red";
admlckActivated.style.fontWeight = "bold";
admlckActivated.style.display = "none";
atlInfo.appendChild(admclrActivated);

menu.addCheckboxOption(" Lock Tiles", () => {
    // activated
    atlInfo.style.display = "";
    admlck.activated = true;
}, function() {
    // deactivated
    atlInfo.style.display = "none";
    admlck.activated = false;
    tiles[currentPosition[1] + "," + currentPosition[0]].backgroundColor = "";
    renderTile(currentPosition[0], currentPosition[1], true);
});

var admlck = {
    activated: false,
    lastPos: null,
    ctrlDown: false,
    color: "#00FFFF",
    renderTile: function(preserveLastPos) {
        if(tiles[currentPosition[1] + "," + currentPosition[0]]) {
            // change color to red
            tiles[currentPosition[1] + "," + currentPosition[0]].backgroundColor = admlck.color;
            if(!preserveLastPos)
                admlck.lastPos = [currentPosition[0], currentPosition[1]];
            // re-render the tile
            renderTile(currentPosition[0], currentPosition[1], true);
        }
    },
    handleLock: (x, y) => {
        network.lock_tile(x, y);
    }
};

// ctrl is pressed
function keydown_admlck(e) {
    if(!admlck.activated) return;
    if(admlck.ctrlDown) return;
    if(e.ctrlKey) {
        admlck.ctrlDown = true;
        admlckActivated.style.display = "";
        admlck.color = "#FF0000";
        admlck.renderTile(true);
        admlck.handleLock(currentPosition[0], currentPosition[1]);
    }
}
document.body.addEventListener("keydown", keydown_admlck);

// mouse is moved
function mousemove_admlck(e) {
    if(!admlck.activated) return;
    if(admlck.lastPos) {
        /*
            currentPosition is the built in way to get the current tile and char position from
            where your mouse cursor is.
            currentPosition = [tileX, tileY, charX, charY]
        */
        // do no re-render if the cursor moved but is still inside the same tile
        if(admlck.lastPos[0] == currentPosition[0] && admlck.lastPos[1] == currentPosition[1]) {
            return;
        }
        var tileBackColorRes = tiles[admlck.lastPos[1] + "," + admlck.lastPos[0]];
        if(tileBackColorRes) tileBackColorRes.backgroundColor = "";
        // re-render the tile
        renderTile(admlck.lastPos[0], admlck.lastPos[1], true);
    }
    // if tile exists
    admlck.renderTile();
    if(admlck.ctrlDown) {
        admlck.handleLock(currentPosition[0], currentPosition[1]);
    }
}
document.body.addEventListener("mousemove", mousemove_admlck)

// a key is released
function keyup_admlck(e) {
    if(!admlck.activated) return;
    admlck.ctrlDown = false;
    admlckActivated.style.display = "none";
    admlck.color = "#00FF00";
    // remove color of tile
    if(admlck.lastPos) {
        tiles[admlck.lastPos[1] + "," + admlck.lastPos[0]].backgroundColor = "";
        // re-render the tile
        renderTile(admlck.lastPos[0], admlck.lastPos[1], true);
    }
    tiles[currentPosition[1] + "," + currentPosition[0]].backgroundColor = "";
    renderTile(currentPosition[0], currentPosition[1], true);
    admlck.lastPos = null;
}
document.body.addEventListener("keyup", keyup_admlck);