import * as core from "@actions/core";
import { startStopBounty } from "./plugin";

startStopBounty()
  .then((result) => {
    core.setOutput("result", result);
  })
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });
