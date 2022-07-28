//this is the permission shit, feel free to mod
var state = {
    "userModel": {
        "username":"fp",
        "is_superuser":true,
        "authenticated":true,
        "is_member":true,
        "is_owner":true,
        "is_staff":true,
        "is_operator":true
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
        "color_text":0
    },
    "announcement": localStorage.getItem("announcement") || undefined

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
