# For Developers

## Debug this extension

- Clone this repository
- Open `mimium-language.code-workspace`
    - Install extension `connor4312.esbuild-problem-matchers` (included in workspace's recommended extension)
- Launch Extension Debug Host from Debugger Tab

## Testing

To test this extension, install `vscode-test` command.

https://code.visualstudio.com/api/working-with-extensions/testing-extension

(TBD)

## Deployment

Pushed commit with tag `vx.x.x` to master branch will automatically triggers deployment. Tag like `vx.x.x-alphax` triggers pre-release deployment.

Note that the version must be the same as in the `package.json`. Do not forget to bump the version.

