# H5

本项目是一个简单的 H5 页面打包工具。功能如下：

* 内置 [LESS][less] 支持；
* 打包时压缩 HTML;
* 打包时处理 JavaScript 脚本（合并、压缩混淆等）；
* 打包时处理样式脚本（预编译 [LESS][less]，添加浏览器前缀，图片转 DataURI，压缩等）；
* 打包时添加文件 hash 后缀；
* 内置静态文件服务器，方便开发调试；

[less]: https://github.com/less/less.js "LESS"

## 相关命令

以下命令均可使用 [cnpm](https://npm.taobao.org/ "淘宝 NPM 镜像") 进行替换。

```bash
# 安装依赖
npm i

# 启动静态文件服务器
npm start

# 启动静态文件服务器并指定端口
#（两个端口: 一个为开发服务器，一个为构建版本的服务器）
npm start 4003 4004

# 打包
npm run build
```

## 打包输出

打包工具将对 `app` 目录下的代码进行打包，并将结果保存在 `dist/${projectName}` 目录下。

## 打包说明

打包工具会处理 HTML 出现的所有 `<style>` 和 `<script>` 标签。同时也会根据 `@remove` 和 `@bundle` 这两个注解进行相关操作。注意，这两个注解都只能用于 `<script>` 标签。

`@remove` 注解功能说明：

```html
<script> var DEBUG = false; </script>

<!-- @remove 注解用于告诉打包工具在打包时移除这个 <script> 标签 -->
<script @remove> var DEBUG = true; </script>

<script> alert(DEBUG); </script>
```

以上代码在打包前会弹出 `true`，在打包后会弹出 `false`。

`@bundle` 注解功能说明：

```html
<!-- 将以下 3 个文件合并为 1 个文件，并保存在 src/polyfill/polyfill-[hash].js 中。 -->
<script @bundle="src/polyfill/polyfill" src="src/polyfill/es5-shim.js"></script>
<script @bundle="src/polyfill/polyfill" src="src/polyfill/es5-sham.js"></script>
<script @bundle="src/polyfill/polyfill" src="src/polyfill/es6-promise.js"></script>

<!-- 将以下 2 个文件合并为 1 个文件，并保存在 src/libs/libs-[hash].js 中。 -->
<script @bundle="src/libs/libs" src="src/libs/zepto.js"></script>
<script @bundle="src/libs/libs" src="src/libs/plupload.js"></script>
```

## DEBUG

在打包 JavaScript 代码时，会在 [UglifyJS][uglifyjs] 的配置中设置 `compress.global_defs.DEBUG` 为 `false`。写代码时可根据 `DEBUG` 全局变量来判断运行时环境，[UglifyJS][uglifyjs] 在打包时会进行优化。如下：

```javascript
if (typeof DEBUG !== 'undefined' && DEBUG) {
    // 处于开发环境
} else {
    // 处于生产环境
}
```

[uglifyjs]: https://github.com/mishoo/UglifyJS2 "UglifyJS"

## 其它

本项目预置了一些第三方库（见于 `src/libs` 目录下，相关协议位于 [licenses](licenses) 目录下），但不是必须的，用户可更根据实际q情况进行添加或移除。

## License

[MIT](LICENSE "License")
