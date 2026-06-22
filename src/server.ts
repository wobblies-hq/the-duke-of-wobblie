const { createNodeMiddleware, createProbot } = require("probot");
const http = require("http");
const app = require("./index").default;

const probot = createProbot();
const middleware = createNodeMiddleware(app, { probot });

const port = process.env.PORT || 3000;
http.createServer(middleware).listen(port, () => {
  console.log(`The Duke of Wobblie listening on port ${port}`);
});
