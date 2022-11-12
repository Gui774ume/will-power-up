/* global TrelloPowerUp */
var Promise = TrelloPowerUp.Promise;

let isGoogleAPIKeyReady = function(t) {
    return new Promise(function (resolve) {
        t.get('board', 'shared', 'google_api_key')
            .then(function(google_api_key) {
                if (google_api_key !== undefined && google_api_key !== "") {
                    return resolve(true);
                }
                return resolve(false);
            })
    })
}

TrelloPowerUp.initialize({
    'card-back-section': function(t, options){
        return new Promise(function(resolve) {
           isGoogleAPIKeyReady(t)
               .then(function(ready) {
                   if (!ready) {
                       return resolve([]);
                   } else {
                       return resolve([{
                           title: 'Location',
                           icon: './svg/map-location-dot-solid.svg',
                           content: {
                               type: 'iframe',
                               url: t.signUrl('./components/location/location-card-section.html'),
                               height: 1,
                           },
                           action: {
                               text: 'Edit',
                               callback: function (t, options) {
                                   if (ready) {
                                       return t.popup({
                                           title: 'Location',
                                           url: './components/location/location-card-form.html',
                                           height: 182,
                                       });
                                   } else {
                                       return t.popup({
                                           title: 'Google API Key missing',
                                           url: './components/google-api-key-required/google-api-key-required.html',
                                           height: 60,
                                       })
                                   }
                               },
                           }
                       }]);
                   }
               })
        });
    },
    'show-settings': function(t, options){
        return t.popup({
            title: 'Settings',
            url: './components/settings/settings.html',
            height: 200,
        });
    },
    'card-buttons': function (t, options) {
        return new Promise(function(resolve) {
            isGoogleAPIKeyReady(t)
                .then(function (ready) {
                    return resolve([{
                        icon: './svg/map-location-dot-solid.svg',
                        text: 'Location',
                        callback: function (t, options) {
                            if (ready) {
                                return t.popup({
                                    title: 'Location',
                                    url: './components/location/location-card-form.html',
                                    height: 182,
                                });
                            } else {
                                return t.popup({
                                    title: 'Google API Key missing',
                                    url: './components/google-api-key-required/google-api-key-required.html',
                                    height: 60,
                                })
                            }
                        }
                    }]);
                });
        });
    },
});