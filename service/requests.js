let retrySendRequest = function (url, method, resolve, reject, retryCount) {
    const Http = new XMLHttpRequest();
    Http.addEventListener("load", async function (progressEvent) {
        if (progressEvent.currentTarget.readyState === 4) {
            if (progressEvent.currentTarget.status === 200) {
                resolve(JSON.parse(progressEvent.currentTarget.responseText));
            } else if (progressEvent.currentTarget.status === 429 && retryCount > 0) {
                retryCount--;
                // wait 3 seconds and try again
                await new Promise(resolve => setTimeout(resolve, 3000));
                retrySendRequest(url, method, resolve, reject, retryCount);
            } else {
                reject(progressEvent.currentTarget.responseText);
            }
        }
    });
    Http.open(method, url);
    Http.send();
}

// sendRequest issues a request to the provided endpoint
export const sendRequest = function (url, method="GET") {
    return new Promise(function (resolve, reject) {
        retrySendRequest(url, method, resolve, reject, 3);
    })
}