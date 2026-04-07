const express = require('express');
const router = require('./router'); // Assuming the router is in the same directory

const app = express();

app.use('/api', router);

const awsLambdaHandler = async (event, context) => {
    // You may need to adjust middleware or request parsing here
    // to suit your specific needs, especially in a Lambda environment
    return await app(event, context);
};

exports.handler = awsLambdaHandler;