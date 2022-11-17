//this is the permission shit, feel free to mod
var state = {
    "userModel": {
        "username":location.search.slice(1) || "realredtext",
        "authenticated":true,
        "is_operator":true,
        "is_superuser":true,
        "is_staff":true,
        "is_owner":true,
        "is_member":true
    },
    "worldModel": { 
        "feature_membertiles_addremove":true,
        "writability":0,
        "feature_url_link":0,
        "feature_go_to_coord":0,
        "name":"",
        "feature_paste":0,
        "namespace":"",
        "readability":0,
        "feature_coord_link":0,
        "pathname":"",
        "chat_permission":0,
        "color_text":0,
        "write_interval": 1000
    },
    "announcement": localStorage.getItem("announcement") || undefined,
    "creation_date": Date(Date.now()).slice(0, 24)
};

//fixing permissions
if(state.userModel.is_operator) {
    state.userModel.is_superuser = true;
    state.userModel.is_staff = true;
};

if(state.userModel.is_superuser) {
    state.userModel.is_staff = true;
};

if(state.userModel.is_owner) {
    state.userModel.is_member = true;
};
