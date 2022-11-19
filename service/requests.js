// sendRequest issues a request to the provided endpoint
export const sendRequest = function (url, method="GET") {
    return new Promise(function (resolve, reject) {
        const Http = new XMLHttpRequest();
        Http.addEventListener("load", function (progressEvent) {
            if (progressEvent.currentTarget.readyState === 4) {
                if (progressEvent.currentTarget.status === 200) {
                    resolve(JSON.parse(progressEvent.currentTarget.responseText));
                } else {
                    reject(progressEvent.currentTarget.responseText);
                }
            }
        });
        Http.open(method, url);
        Http.send();
    })
}