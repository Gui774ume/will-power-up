import { WillPowerUpAppKey, WillPowerUpAppName } from '../../constants.js';
import { sanitizeInput } from "../../service/utils.js";

let t = TrelloPowerUp.iframe({
    appKey: WillPowerUpAppKey,
    appName: WillPowerUpAppName,
});

var trelloAuthUrl = `https://trello.com/1/authorize?expiration=never&name=${sanitizeInput(WillPowerUpAppName)}`+
    `&scope=read,write&key=${WillPowerUpAppKey}&callback_method=fragment&return_url=${window.location.href.substring(0, window.location.href.lastIndexOf('/'))}/auth-callback.html`;

var isTokenValid = function(token) {
    // If this returns false, the Promise won't resolve.
    if (/^[0-9a-f]{64}$/.test(token)) {
        return true;
    }
    // indicate that authorization failed
    t.alert({
        message: "Authorization process aborted",
        duration: 6,
    });
}

t.render(function() {
    t.sizeTo("#authorize_wrapper");

    document.getElementById('authorize').addEventListener('click', function(){
        t.authorize(trelloAuthUrl, { height: 680, width: 580, validToken: isTokenValid})
            .then(function(token){
                // store the token in Trello private Power-Up storage
                return t.set('member', 'private', 'token', token);
            })
            .then(function(){
                return t.closePopup();
            });
    });
});