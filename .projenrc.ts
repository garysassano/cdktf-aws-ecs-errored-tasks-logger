import { javascript } from "projen";
import { CdktfTypeScriptApp } from "projen-cdktf-app-ts";
const project = new CdktfTypeScriptApp({
  defaultReleaseBranch: "main",
  depsUpgradeOptions: { workflow: false },
  devDeps: ["projen-cdktf-app-ts"],
  eslint: true,
  minNodeVersion: "20.15.0",
  name: "cdktf-aws-ecs-task-events-logger",
  packageManager: javascript.NodePackageManager.PNPM,
  pnpmVersion: "9.4.0",
  prettier: true,
  projenrcTs: true,

  terraformProviders: ["hashicorp/aws@~> 5.54.1"],
});

// Generate CDKTF constructs after installing deps
project.tasks.tryFind("install")?.spawn(project.cdktfTasks.get);

project.synth();
