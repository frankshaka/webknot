////////////////////////////////////////////////
//
// Web Request Handler
//
////////////////////////////////////////////////


// Add 'startsWith' function to String objects
// Reference: http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}

var http = require('http');
var urlParser = require('url');
var qs = require('querystring');

var mainHTML = 'Gotcha!';

var converters = {

    'test': function(data, headers) {
        var url = headers['x-target-url'] || 'http://requestb.in/1msdb5t1';
        return {
            url: url,
            format: 'json',
            data: data
        };
    },

    'sns2slack': function(data, headers) {
        return {
            url: 'https://hooks.slack.com/services/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',
            format: 'json',
            data: {
                'text': '' + data['Subject'] + '\n\n' + data['Message']
            }
        };
    }
};

var formatters = {
    'form': {
        contentType: 'application/x-www-form-urlencoded',
        stringify: qs.stringify,
        parse: qs.parse
    },
    'json': {
        contentType: 'application/json',
        stringify: JSON.stringify,
        parse: JSON.parse
    }
};

var defaultFormatter = {
    contentType: 'text/plain',
    stringify: function(data) { return data; },
    parse: function(data) { return data; }
};

function parseData(text, contentType) {
    for (var k in formatters) {
        if (contentType.startsWith(formatters[k].contentType)) {
            return formatters[k].parse(text);
        }
    }
    return defaultFormatter.parse(text);
}


function handleQueryRequest(request, response) {
    if (request.location.pathname == '/') {
        response.writeHead(200);
        response.end(mainHTML);
    }else {
        response.writeHead(404);
        response.end();
    }
}

function handleWebhookRequest(request, response) {
    var converterType = request.location.pathname.substr(1);
    console.log('CONVERTER_TYPE: ' + converterType);
    var convert = converters[converterType];
    if (!convert) {
        response.writeHead(404);
        return response.end();
    }

    var requestBody = '';
    request.on('data', function(chunk) {
        requestBody += chunk;
    });
    request.on('end', function() {
        console.log('REQUEST_BODY: ' + requestBody);
        var contentType = request.headers['content-type'];
        var requestData = parseData(requestBody, contentType);

        var upstream = convert(requestData, request.headers);
        if (!upstream) {
            response.writeHead(400);
            return response.end();
        }

        console.log('UPSTREAM OPTIONS: ' + JSON.stringify(upstream));

        var upstreamRequestOptions = urlParser.parse(upstream.url);
        upstreamRequestOptions.method = upstream.method || 'POST';
        upstreamRequestOptions.headers = upstream.headers || {};

        var formatter = formatters[upstream.format] || defaultFormatter;
        var upstreamRequestBody = formatter.stringify(upstream.data);
        upstreamRequestOptions.headers['Content-Type'] = formatter.contentType;
        upstreamRequestOptions.headers['Content-Length'] = (upstreamRequestBody||'').length;

        var upstreamRequest = http.request(upstreamRequestOptions, function(upstreamResponse) {
            var upstreamResponseStatusCode = upstreamResponse.statusCode;
            var upstreamResponseBody = '';
            upstreamResponse.setEncoding('utf8');
            upstreamResponse.on('data', function(chunk) {
                upstreamResponseBody += chunk;
            });
            upstreamResponse.on('end', function() {
                console.log('RESPONSE: [' + upstreamResponseStatusCode + '] ' + upstreamResponseBody);
                response.writeHead(upstreamResponseStatusCode, {
                    'Content-Type': upstreamResponse.headers['content-type']
                });
                response.write(upstreamResponseBody);
                response.end();
            });
        });
        upstreamRequest.on('error', function handleError(error) {
            console.log('RESPONSE_ERROR: ' + error.message);
            response.writeHead(500);
            response.write(error.message);
            response.end();
        });
        upstreamRequest.write(upstreamRequestBody);
        upstreamRequest.end();
    });
}

function handleRequest(request, response) {
    request.location = urlParser.parse(request.url);
    if (request.method == 'GET') {
        return handleQueryRequest(request, response);
    }else if (request.method == 'POST') {
        return handleWebhookRequest(request, response);
    }else {
        response.writeHead(405);
        response.end();
    }
}

var port = process.env.PORT || 18080;
http.createServer(handleRequest).listen(port);

console.log('Server running at port ' + port);
