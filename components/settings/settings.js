let t = TrelloPowerUp.iframe();
let inputGoogleAPIKey = document.getElementById('google_api_key');
let save = document.getElementById('save');
let googleMapsAutocomplete = document.getElementById('google_maps_autocomplete');

t.render(function(){
    t.get('board', 'shared', 'google_api_key')
        .then(function(google_api_key) {
            if (google_api_key !== undefined) {
                inputGoogleAPIKey.value = google_api_key;
            }
            t.get('board', 'shared', 'google_maps_autocomplete')
                .then(function(autocompleteEnabled) {
                    if (autocompleteEnabled === undefined) {
                        autocompleteEnabled = true;
                    }
                    if (autocompleteEnabled) {
                        googleMapsAutocomplete.textContent = "Disable Google Maps autocomplete";
                        googleMapsAutocomplete.classList.remove("mod-primary");
                        googleMapsAutocomplete.classList.add("mod-danger");
                    } else {
                        googleMapsAutocomplete.textContent = "Enable Google Maps autocomplete";
                        googleMapsAutocomplete.classList.remove("mod-danger");
                        googleMapsAutocomplete.classList.add("mod-primary");
                    }
                });
        })
        .then(function(){
           t.sizeTo('#settings');
        });
});

document.getElementById('google_api_key').addEventListener('change', function(){
    return t.set('board', 'shared', 'google_api_key', inputGoogleAPIKey.value);
});

document.getElementById('show_google_api_key').addEventListener('mousedown', function(){
    inputGoogleAPIKey.type = "text"
});

document.getElementById('show_google_api_key').addEventListener('mouseup', function(){
    inputGoogleAPIKey.type = "password"
});

save.addEventListener('click', function() {
    return t.set('board', 'shared', 'google_api_key', inputGoogleAPIKey.value);
});

googleMapsAutocomplete.addEventListener('click', function() {
    t.get('board', 'shared', 'google_maps_autocomplete')
        .then(function(autocompleteEnabled) {
            if (autocompleteEnabled === undefined) {
                autocompleteEnabled = true;
            } else {
                autocompleteEnabled = !autocompleteEnabled;
            }
            t.set('board', 'shared', 'google_maps_autocomplete', autocompleteEnabled);
        });
});