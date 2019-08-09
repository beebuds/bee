const AWSSDK = require('aws-sdk');

module.exports.loadCredentials = function loadCredentials(AWS, profile, region) {
    console.log(`loadCredentials profile:${profile} region:${region}`);
    AWS.config.region = 'eu-west-1';
    const envProxy = process.env.https_proxy || process.env.http_proxy;
    if (profile && typeof (profile) === 'string') {
        console.log(`do AWS.SharedIniFileCredentials: ${profile}`);
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: profile });
    } else if (envProxy) {
        console.log(`Use proxy config ${envProxy}`);
        AWS.config.update({
            httpOptions: { agent: proxy(envProxy) }
        });
    }

    if (region) {
        AWS.config.region = region;
    }
}
module.exports.cloudformationDescribeStacks = async function (AWS, params) {
    loadCredentials(AWS, params.profile, params.region);
    const cf = new AWSSDK.CloudFormation();
    return cf.describeStacks({ StackName: params.stackName }).promise();
}
module.exports.cloudformationPackage = async function (AWS, params) {
    loadCredentials(AWS, params.profile, params.region);
    const cf = new AWSSDK.CloudFormation();
}