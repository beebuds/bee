const AWS = require('aws-sdk');
const utils = require('./utils')
const jsonwebtoken = require('jsonwebtoken');
function certToPEM(cert) {
    cert = cert.match(/.{1,64}/g).join('\n');
    cert = '-----BEGIN PRIVATE KEY-----\n' + cert + '\n-----END PRIVATE KEY-----\n';
    return cert;
}

let privateKeyForSigning = "";
async function init(AWS) {
    const s3 = new AWS.S3();
    const responseFromS3 = await s3.getObject({ "Bucket": "jwt-authoriser-keystore", "Key": "private_key.json" }).promise();
    const cert = responseFromS3.Body.toString();
    privateKeyForSigning = certToPEM(cert);
}

function generateToken(options) {
    const jwtPayload = { "sub": options.subject || "Bee Subject", "name": options.name || "Bee Bee", "aud": options.aud || "Bee Audience", "iss": options.issuer || "Bee Issuer", "exp": options.expiration || (new Date().getTime() + 3600 * 1000), "scope": options.scope || '' };
    const signedToken = jsonwebtoken.sign(jwtPayload, privateKeyForSigning, { algorithm: 'RS256' });
    return signedToken;
}

module.exports.init = init;
module.exports.generateToken = generateToken;
