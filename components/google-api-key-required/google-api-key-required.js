let t = TrelloPowerUp.iframe();
let settingsButton = document.getElementById('settings');

t.render(function(){
    t.sizeTo("#google_api_key_wrapper");
});

settingsButton.addEventListener('click', function () {
    t.popup({
        title: 'Settings',
        url: '../settings/settings.html',
        height: 200,
    });
});