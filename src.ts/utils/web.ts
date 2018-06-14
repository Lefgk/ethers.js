
import { XMLHttpRequest } from 'xmlhttprequest';
import { toUtf8Bytes } from './utf8';
import { encode as base64Encode } from './base64';

export type ConnectionInfo = {
    url: string,
    user?: string,
    password?: string,
    allowInsecure?: boolean
};

import * as errors from './errors';

export type ProcessFunc = (value: any) => any;

type Header = { key: string, value: string };

export function fetchJson(url: string | ConnectionInfo, json: string, processFunc: ProcessFunc): Promise<any> {
    let headers: Array<Header> = [ ];

    if (typeof(url) === 'object' && url.url != null) {
        if (url.url == null) {
            errors.throwError('missing URL', errors.MISSING_ARGUMENT, { arg: 'url' });
        }
        if (url.user != null && url.password != null) {
            if (url.url.substring(0, 6) !== 'https:' && url.allowInsecure !== true) {
                errors.throwError(
                    'basic authentication requires a secure https url', 
                    errors.INVALID_ARGUMENT,
                    { arg: 'url', url: url.url, user: url.user, password: '[REDACTED]' }
                );
            }

            var authorization = url.user + ':' + url.password;
            headers.push({
                key: 'Authorization',
                value: 'Basic ' + base64Encode(toUtf8Bytes(authorization))
            });
        }

        url = url.url;
    }

    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();

        if (json) {
            request.open('POST', url, true);
            headers.push({ key: 'Content-Type', value: 'application/json' });
        } else {
            request.open('GET', url, true);
        }

        headers.forEach(function(header) {
            request.setRequestHeader(header.key, header.value);
        });

        request.onreadystatechange = function() {
            if (request.readyState !== 4) { return; }

            try {
                var result = JSON.parse(request.responseText);
            } catch (error) {
                // @TODO: not any!
                var jsonError: any = new Error('invalid json response');
                jsonError.orginialError = error;
                jsonError.responseText = request.responseText;
                jsonError.url = url;
                reject(jsonError);
                return;
            }

            if (processFunc) {
                try {
                    result = processFunc(result);
                } catch (error) {
                    error.url = url;
                    error.body = json;
                    error.responseText = request.responseText;
                    reject(error);
                    return;
                }
            }

            if (request.status != 200) {
                // @TODO: not any!
                var error: any = new Error('invalid response - ' + request.status);
                error.statusCode = request.statusCode;
                reject(error);
                return;
            }

            resolve(result);
        };

        request.onerror = function(error) {
            reject(error);
        }

        try {
            if (json) {
                request.send(json);
            } else {
                request.send();
            }

        } catch (error) {
            // @TODO: not any!
            var connectionError: any = new Error('connection error');
            connectionError.error = error;
            reject(connectionError);
        }
    });
}
