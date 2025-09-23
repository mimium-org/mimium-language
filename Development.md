# For Developers

## Debug this extension

- Clone this repository
- Open `mimium-language.code-workspace`
    - Install extension `connor4312.esbuild-problem-matchers` (included in workspace's recommended extension)
- Launch Extension Debug Host from Debugger Tab

### Debug with locally built Language Server 

The extension client tries to find `mimium-language-server` command as follwing order

1. environment variable `MIMIUM_SERVER_PATH`
2. under the directory where the extension tries to download & install mimium binary `~/.mimium/`
3. just tries to invoke `mimium-language-server` command

So if you want to debug locally built language server replace environment variable `MIMIUM_SERVER_PATH` on `launch.json` to your debugging language server like `(...)/mimium-rs/target/debug/mimium-language-server` and then start debugging with "Launch Client".

If you want to set breakpoints to server, start debugging with "Attach to Server" after launching client, and search the server process by typing process name "mimium-language-server".

## Testing

To test this extension, install `vscode-test` command.

https://code.visualstudio.com/api/working-with-extensions/testing-extension

## Deployment

Pushed commit with tag `vx.x.x` to master branch will automatically triggers deployment. Tag like `vx.x.x-alphax` triggers pre-release deployment.

Note that the version must be the same as in the `package.json`. Do not forget to bump the version.

