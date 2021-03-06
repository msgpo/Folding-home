/*
 * Licensed under the LICENSE.
 * Copyright 2017, Sony Mobile Communications Inc.
 */

const _ = require('lodash');
const request = require('request');

const APP_ID = '<PLACE_YOUR_FACEBOOK_APP_ID_HERE>';
const CLIENT_SECRET = '<PLACE_YOUR_FACEBOOK_CLIENT_SECRET_HERE>';

const FB_OG_TYPE = '<PLACE_YOUR_FACEBOOK_OPEN_GRAPH_TYPE_HERE>';
const FB_OG_OBJECT = '<PLACE_YOUR_FACEBOOK_OPEN_GRAPH_OBJECT_HERE>';
const FB_OG_PATH = '<PLACE_YOUR_FACEBOOK_OPEN_GRAPH_PATH_HERE>';
const FB_OG_URL = '<PLACE_YOUR_FACEBOOK_OPEN_GRAPH_URL_HERE>';
const FB_OG_IMAGE = '<PLACE_YOUR_POST_IMAGE_HERE>';
const FB_OG_TITLE = '<PLACE_YOUR_POST_TITLE_HERE>';
const FB_SHARE_URL = '<PLACE_YOUR_POST_URL_HERE>';

const REDIRECT_SUCCESS = '<PLACE_YOUR_FACEBOOK_OAUTH_REDIRECT_URL_HERE>';
const URI = 'https://www.facebook.com/dialog/oauth?client_id=' + APP_ID + '&redirect_uri=' + REDIRECT_SUCCESS + '&response_type=token' + '&display=popup' + '&scope=' + 'public_profile,publish_actions';

let credentials = global.facebookCredentialsData.getAll() || {};

let getParamsFromRedirect = (urlStr) => {
    let url = require('url').parse(urlStr);
    let querystring = require('querystring');
    return querystring.parse(url.query);
};

let extendTokenExpirationTime = (token) => {
    request('https://graph.facebook.com/oauth/access_token?client_id=' + APP_ID + '&client_secret=' + CLIENT_SECRET + '&grant_type=fb_exchange_token&fb_exchange_token=' + token, (error, response, body) => {

    });
};

let checkPublishPermission = (BrowserWindow, callback) => {
    request('https://graph.facebook.com/me/permissions?access_token=' + credentials.access_token, (error, response, body) => {
        if (!error && response.statusCode == 200) {
            let data = JSON.parse(body).data;
            if (data.length > 0) {
                let permission = _.find(data, (item) => {
                    return item.permission === 'publish_actions' && item.status === 'granted';
                });

                if (permission) {
                    shareHistory(callback);
                } else {
                  getAccessToken(BrowserWindow, callback);
                }
            }
        } else {
            getAccessToken(BrowserWindow, callback);
        }
    });
};

let getAccessToken = (BrowserWindow, callback) => {
    let browserWindow = new BrowserWindow({
        show: true,
        parent: global.mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false
        }
    });

    browserWindow.loadURL(URI);

    browserWindow.on('closed', () => {
        browserWindow = null;
    });

    browserWindow.webContents.on('did-finish-load', function (event, oldUrl, newUrl) {
        if (event.sender.webContents.history) {
            let lastUri = _.last(event.sender.webContents.history);
            let params = getParamsFromRedirect(lastUri.replace('#', '?'));
            if (!_.isEmpty(params) && params.access_token) {
                loginSuccess(params.access_token, callback);
                browserWindow.close();
            } else if (!_.isEmpty(params) && params.error && params.error_code == '200') {
              browserWindow.close();
            }

        }
    });

    browserWindow.on('blur', () => {
        browserWindow.close();
    });
};

let loginSuccess = (accessToken, callback) => {
    if (accessToken) {
        extendTokenExpirationTime(accessToken);
        credentials.access_token = accessToken;
        global.facebookCredentialsData.updateAll(credentials);
        shareHistory(callback);
    }
};

let shareHistory = (callback) => {
    let peopleHelpingOut = global.miscData.getPeopleHelpingOut() || 1;
    let contributedTime = global.contributionTimeData.getTotalContributedTime(true);
    let shareDescription = global.i18n.__('fb_share_og_description', peopleHelpingOut, contributedTime, FB_SHARE_URL);

    let ogObject = {
        'og:type': FB_OG_TYPE,
        'og:title': FB_OG_TITLE,
        'og:description': shareDescription,
        'og:url': FB_OG_URL,
        'og:image': FB_OG_IMAGE,
        'gridcomputing:number_users': peopleHelpingOut,
        'gridcomputing:time_spent': contributedTime
    };

    let data = 'access_token=' + credentials.access_token + "&" + FB_OG_OBJECT + "=" + JSON.stringify(ogObject) + '&fb:explicitly_shared=true';

    request.post({url: 'https://graph.facebook.com/me/' + FB_OG_PATH, form: data}, (err, httpResponse, body) => {
        if (callback) {
            callback(err);
        }
    });
};


module.exports = {
    checkPublishPermission: checkPublishPermission,
};
