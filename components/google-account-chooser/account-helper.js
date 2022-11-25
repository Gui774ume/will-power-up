// Discovery doc URL for APIs used by the Power-Up
export const PEOPLE_DOC = 'https://people.googleapis.com/$discovery/rest?version=v1';
export const CALENDAR_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

export const getGoogleAccountToken = function(t, email) {
    return new Promise(function(resolve) {
        t.get('board', 'private', email)
            .then(function(account) {
                if (account === undefined) {
                    resolve(null);
                } else {
                    // check if the saved token will expire in less than 5 minutes
                    if (account.tokenExpiresAt - new Date() < 300) {
                        // expire the token early to make sure we won't hit access denied issues
                        resolve(null);
                    } else {
                        resolve(account.token);
                    }
                }
            });
    });
}