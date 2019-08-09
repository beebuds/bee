#! /usr/bin/env node

var Mocha = require('mocha');
var Chai = require('chai');
const argv = require('yargs').argv;
const jwtUtils = require('./lib/jwt-utils');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const AWS = require('aws-sdk');
const utils = require('./lib/utils');
const glob = require('glob-promise');
const constants = require('./lib/constants');
const defaultItestsDirectory = `${constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory}/itests`;
const defaultTokensDirectory = `${defaultItestsDirectory}/tokens`;
const ALLOW = 'ALLOW';
const DENY = 'DENY';
const os = require('os');

var Test = Mocha.Test;
var expect = Chai.expect;

function ensureDefaultDirs() {
    fs.mkdirpSync(defaultTokensDirectory);
}
function verifyTestSpec(testSpec, testSpecFileName) {
    if (!testSpec.TestSuites) {
        console.error(`ERROR: Invalid test specification file ${testSpecFileName}: missing 'TestSuites' section!`);
        process.exit(1);
    }

    if (testSpec.TestSuites.length > 0 && !testSpec.TestSuites[0].Tests) {
        console.error(`ERROR: Invalid test specification file ${testSpecFileName}: missing 'TestSuites.Tests' section!`);
        process.exit(1);
    }
}

function resolveSetup(setup, testSpecFileName) {
    const resolvedSetup = [];
    if (setup) {
        setup.map(s => {
            if (typeof s === 'string') {
                const setupSpec = yaml.safeLoad(fs.readFileSync(utils.getRelativePath(testSpecFileName, s), 'utf8'));
                if (setupSpec.Setup && setupSpec.Setup.length > 0) {
                    setupSpec.Setup.map(action => {
                        resolvedSetup.push(action);
                    });
                }
            } else {
                resolvedSetup.push(s);
            }
        });
    }
    return resolvedSetup;
}

async function runSetupFunctions(setupFunctions) {
    if (setupFunctions && setupFunctions.length > 0) {
        utils.ylog(`Start SETUP phase...`);
        for (let i = 0; i < setupFunctions.length; ++i) {
            await setupFunctions[i]();
        }
        utils.ylog(`End SETUP phase.`);
    }
}

if (!argv.test_spec) {
    console.error(`ERROR: Missing test specification file ', use --test_spec=<YAML test spec. file path pattern>, e.g. --test_spec=*/**/*.itest.yml`);
    process.exit(1);
}

let stackName;
let serviceName;
if (!argv.api_id && !argv.stack_name) {
    const cfVariables = utils.loadCfVariables();
    console.log(JSON.stringify(cfVariables));
    if (!cfVariables) {
        console.error(`ERROR: Missing REST API id (api gateway id) or CloudFormation stack name, use --api_id=<rest api id> or --stack_name=<stack name>, e.g. --api_id=a8d4f9w2 or --stack_name=my-cloudformation-stack`);
        process.exit(1);
    }
    stackName = cfVariables.stackName;
    serviceName = cfVariables.serviceName;
}

let mochaTimeout = (argv.timeout) ? argv.timeout : 30000;


function getRelevantStatementsFromPolicy(methodAndResource, policy) {
    return policy.Statement.filter(s => {
        const relevantResources = s.Resource.filter(r => r.endsWith(methodAndResource));
        return relevantResources.length > 0;
    });
}

function transformResourcePath(resource) {
    return resource.replace(/^\//, '').replace(/\{([a-zA-Z])+\}/g, '*');
}
function hasAllowAndNoDenyEffectForMethodAndResource(method, resource, policy) {
    const logPolicyIfDeny = (methodAndResource) => {
        utils.rlog(`FAILED: 
        actual policy: ${JSON.stringify(policy)}
        expected resource: ...${methodAndResource}
        `);
        return DENY;
    }

    if (method && resource && policy) {
        const methodAndResource = `/${method}/${transformResourcePath(resource)}`;
        const relevantStatements = getRelevantStatementsFromPolicy(methodAndResource, policy);
        const allow = relevantStatements.filter(r => r.Effect === 'Allow').length > 0 &&
            relevantStatements.filter(r => r.Effect === 'Deny').length === 0;
        return (allow) ? ALLOW : logPolicyIfDeny(methodAndResource);
    }
    return logPolicyIfDeny(methodAndResource);
}
function hasDenyEffectForMethodAndResource(method, resource, policy) {
    const logPolicyIfAllow = (methodAndResource) => {
        utils.rlog(`FAILED: 
        actual policy: ${JSON.stringify(policy)}
        expected resource: ...${methodAndResource}
        `);
        return ALLOW;
    }
    if (method && resource && policy) {
        const methodAndResource = `/${method}/${transformResourcePath(resource)}`;
        const relevantStatements = getRelevantStatementsFromPolicy(methodAndResource, policy);
        const deny = relevantStatements.filter(r => r.Effect === 'Deny').length > 0;
        const allow = relevantStatements.filter(r => r.Effect === 'Allow').length > 0;
        return (deny) ? DENY : (allow) ? logPolicyIfAllow(methodAndResource) : DENY;
    }
    return logPolicyIfAllow(methodAndResource);
}

let overallFailures = 0;

async function runTestSpecFile(serviceName, testSpecFile, apiGateway, restApiId, resources, authorizer) {
    const testSpec = yaml.safeLoad(fs.readFileSync(testSpecFile, 'utf8'));
    verifyTestSpec(testSpec, testSpecFile);

    const mochaInstance = new Mocha((argv.test_result_file && typeof (argv.test_result_file) === 'string')
        ? {
            timeout: mochaTimeout,
            reporter: 'mocha-junit-reporter',
            reporterOptions: {
                mochaFile: argv.test_result_file,
                jenkinsMode: true
            }
        }
        : { timeout: mochaTimeout });
    utils.blog(`EXECUTE TEST SPEC: '${testSpecFile}'`);
    utils.ylog(`USE restApiId: '${restApiId}' authorizerId: '${(authorizer) ? authorizer.id : undefined}'`);
    testSpec.TestSuites.map(suite => {
        var testSuiteInstance = Mocha.Suite.create(mochaInstance.suite, "\x1b[94m" + 'TEST SUITE: ' + "\x1b[37m" + suite.Description);
        suite.Tests.map(test => {
            const setupFunctions = [];
            resolveSetup(test.Setup, testSpecFile).map(setup => {
                const filteredResources = resources.items.filter(item => {
                    return item.path === setup.Endpoint && item.resourceMethods[setup.Method]
                });
                const resourceToBeTested = filteredResources[0];
                const testInvokeMethodParams = {
                    httpMethod: setup.Method,
                    resourceId: resourceToBeTested.id,
                    restApiId: restApiId,
                    body: setup.Input.Body,
                    pathWithQueryString: setup.Resource,
                    headers: setup.Input.Headers
                };
                const setupFunction = async () => {
                    console.log(`REQUEST: ${testInvokeMethodParams.httpMethod} ${testInvokeMethodParams.pathWithQueryString}`);
                    console.log(`REQUEST: headers: ${JSON.stringify(testInvokeMethodParams.headers)}`);
                    console.log(`REQUEST: body: ${testInvokeMethodParams.body}`);
                    const response = await apiGateway.testInvokeMethod(testInvokeMethodParams).promise();
                    console.log(`RESPONSE: ${response.status}`);
                };
                setupFunctions.push(setupFunction);
            });

            const testAction = test.Test || test.AuthTest;
            const filteredResources = resources.items.filter(item => {
                return item.path === testAction.Endpoint && item.resourceMethods[testAction.Method]
            });

            const resourceToBeTested = filteredResources[0];
            const testType = (test.AuthTest) ? 'AUTHTEST' : 'TEST';
            const testFunction = async () => {
                utils.ylog(`${testType} CASE: ${test.Description}`);
                await runSetupFunctions(setupFunctions);

                let response;
                if (test.Test) {
                    const testInvokeMethodParams = {
                        httpMethod: testAction.Method,
                        resourceId: resourceToBeTested.id,
                        restApiId: restApiId,
                        body: testAction.Input.Body,
                        pathWithQueryString: testAction.Resource,
                        headers: testAction.Input.Headers
                    };
                    response = await apiGateway.testInvokeMethod(testInvokeMethodParams).promise();
                    const logResponse = {
                        status: response.status,
                        body: response.body,
                        headers: response.headers,
                        multiValueHeaders: response.multiValueHeaders,
                        latency: response.latency
                    }
                    console.log(logResponse);
                    if (testAction.Expect.Status) {
                        expect(response.status).to.be.equal(testAction.Expect.Status);
                    }
                    if (testAction.Expect.Headers) {
                        expect(response.headers).to.include(testAction.Expect.Headers);
                    }
                    if (testAction.Expect.Body) {
                        expect(response.body).to.be.equal(testAction.Expect.Body);
                    }

                } else if (test.AuthTest) {
                    const requestRoles = test.AuthTest.Input.Roles.reduce((a, b) => `${a}${(a) ? ' ' : ''}${b.trim()}`, '');
                    const jwtToken = jwtUtils.generateToken({ scope: requestRoles });
                    console.log(`used token: ${jwtToken}`);
                    const testInvokeAuthorizerParams = {
                        restApiId: restApiId,
                        authorizerId: authorizer.id,
                        headers: {
                            Authorization: `Bearer ${jwtToken}`
                        },
                        stageVariables: {
                            SERVICE_NAME: serviceName
                        }
                    };
                    response = await apiGateway.testInvokeAuthorizer(testInvokeAuthorizerParams).promise();
                    const logResponse = {
                        clientStatus: response.clientStatus,
                        policy: response.policy,
                        latency: response.latency
                    }
                    console.log(logResponse);
                    const expectAllow = () => {
                        expect(response.clientStatus).to.be.equal(0);
                        expect(hasAllowAndNoDenyEffectForMethodAndResource(testAction.Method, testAction.Endpoint, JSON.parse(response.policy))).to.be.equal(ALLOW);
                    };
                    const expectDeny = () => {
                        expect(response.clientStatus).to.be.oneOf([401, 0]);
                        if (response.clientStatus == 0) {
                            expect(hasDenyEffectForMethodAndResource(testAction.Method, testAction.Endpoint, JSON.parse(response.policy))).to.be.equal(DENY);
                        }
                    }
                    const access = testAction.Expect.Access.trim();
                    if (access === ALLOW) {
                        expectAllow();
                    }
                    if (access === DENY) {
                        expectDeny();
                    }
                }
            };
            const mochaTest = new Test(`\x1b[94m ${testType} CASE:\x1b[37m ${test.Description}`, testFunction);
            testSuiteInstance.addTest(mochaTest);
        });
    });

    const moachTestPromise = new Promise((resolve, _reject) => {
        mochaInstance.run(failures => {
            overallFailures += failures;
            resolve(overallFailures);
        });
    });
    return moachTestPromise;
}

ensureDefaultDirs();
const region = (argv.region) ? argv.region : constants.DEFAULT_REGION;
utils.loadCredentials(AWS, argv.profile, region);
(async () => {
    try {
        await jwtUtils.init(AWS);
        const restApiId = await utils.getApiId({
            AWSCloudFormation: new AWS.CloudFormation(),
            apiId: argv.api_id,
            stackName: (stackName) ? stackName : argv.stack_name,
            profile: argv.profile,
            region: argv.region
        });

        const params = {
            restApiId: restApiId,
            limit: 500
        };
        console.log(`got restApiId: ${restApiId}`);
        const apiGateway = new AWS.APIGateway();
        console.log(`get authorizers: ${JSON.stringify(params)}`);
        const authResponse = await apiGateway.getAuthorizers(params).promise();
        console.log(`${authResponse.items.length} authorizer(s) found for RestApiId ${restApiId}`);
        const authorizer = (authResponse.items.length > 0) ? authResponse.items[0] : undefined;
        const resources = await apiGateway.getResources(params).promise();
        console.log(`get resources: ${JSON.stringify(params)}`);

        const files = await glob(argv.test_spec);
        console.log(`test files '${argv.test_spec}': ${JSON.stringify(files)}`);
        for (let i = 0; i < files.length; ++i) {
            await runTestSpecFile(serviceName, files[i], apiGateway, restApiId, resources, authorizer);
        }
        console.log(`overallFailures: ${overallFailures}`);
    } catch (err) {
        console.error(`ERROR: ${err.message}`, err.stack);
        overallFailures++;
    } finally {
        process.exit(overallFailures);
    }
})();