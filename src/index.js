const webpack = require('webpack')
const lodash = require('lodash')
const path = require('path')
const { RuntimeGlobals } = require('webpack');
const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
const virtualFilesystem = require('./lib/virtual-file-system');
const { minify } = require("terser");
const { RawSource } = webpack.sources || require('webpack-sources');
const prettier = require('prettier');
const pluginName = 'AssetsLoadErrorDemotionWebpackPlugin'
const PLUGIN_CORE_FILE = 'assets_load_error_demotion_core'
const PLUGIN_CORE_FILE_EXT = `${PLUGIN_CORE_FILE}.js`
const fs = require('fs')

class AssetsLoadErrorDemotionWebpackPlugin {
  
  constructor({ resources = [], inject = 'head', inlineSource = true, dynamicResources, globalVariable = '$cdn', reloadQueryValue, chunkPublicpath= [], maxChunkRetries = 3, chunkRetryDelay = 3000 }) {
    if( !['head', 'body'].includes(inject) ) {
      return console.error('Use head or body as inject parameters')
    }
    
    this.inject = inject
    this.inlineSource = inlineSource
    this.resources = resources
    this.dynamicResources = dynamicResources
    this.globalVariable = globalVariable
    this.chunkPublicpath = chunkPublicpath
    this.maxChunkRetries = maxChunkRetries
    this.reloadQueryValue = reloadQueryValue || function (url, times) {
      if( times === 0 ) {
        return url
      }
      return url + '?reload=' + times
    }

    if( typeof chunkRetryDelay === 'function' ) {
      const chunkRetryDelayStr = chunkRetryDelay.toString()
      if( chunkRetryDelayStr.indexOf('function')=== -1) {
        throw Error('chunkRetryDelay 需要使用 function 字段声明, 如 chunkRetryDelay: function () { \n  }')
      }
      this.chunkRetryDelay = chunkRetryDelayStr
    }else {
      this.chunkRetryDelay = chunkRetryDelay
    }
  }


  apply(compiler) {
    const { resources, dynamicResources, globalVariable } = this
    let coreJsContent = ``
    
    if( this.resources ) {
      const resourcesBackup = resources.map(_url => _url.slice(1))

      coreJsContent += `
        window.__CDN_RELOAD__ = (function () {
          var cdnAssetsList = ${JSON.stringify(resourcesBackup)}
          var cdnReloadTimesMap = {};

          return function (domTarget, cdnIndex) {
            var tagName = domTarget.tagName.toLowerCase()
            var getTimes = cdnReloadTimesMap[cdnIndex] === undefined ? ( cdnReloadTimesMap[cdnIndex] = 0 ) : cdnReloadTimesMap[cdnIndex]
            var useCdnUrl = cdnAssetsList[cdnIndex][getTimes++]
            cdnReloadTimesMap[cdnIndex] = getTimes
            if( !useCdnUrl ) {
              return
            }
            if( tagName === 'script' ) {
              var scriptText = '<scr' + 'ipt type=\"text/javascript\" src=\"' + useCdnUrl + '\" onerror=\"__CDN_RELOAD__(this, ' + cdnIndex + ')\" ></scr' + 'ipt>'
              document.write(scriptText)
            }
            else if( tagName === 'link' ) {
              var newLink = domTarget.cloneNode()
              newLink.href = useCdnUrl
              domTarget.parentNode.insertBefore(newLink, domTarget)
            }
          }
        })();
      `
    }

    if( this.dynamicResources) {
      coreJsContent += `
        window[${JSON.stringify(globalVariable)}] = (function () {
          var head = document.getElementsByTagName('head')[0]
          var cdnAssetsList =  ${JSON.stringify(dynamicResources)}
          var loadTimesMap = {}
          var cdnCache = {}

          function loaderScript (src, options, successCallBack, errorCallback) {
            var $script = document.createElement('script')
            for (var key in options) {
              $script[key] = options[key]
            }
            $script['crossorigin'] = 'anonymous'
            $script.onload = successCallBack
            $script.onerror = errorCallback
            $script.src = src
            ;(document.body || document.head).appendChild($script)
            return $script
          }

          function loaderCss (src, options, successCallBack, errorCallback) {
            var $link = document.createElement('link')
            for (var key in options) {
              $script[key] = options[key]
            }
            $link.onload = successCallBack
            $link.onerror = errorCallback
            $link.href = src
            $link.rel = 'stylesheet'
            $link.type = 'text/css'
            ;(head || document.head || document.body).appendChild($link)
            return $link
          }

          function removeScript (element) {
            (document.body || document.head).removeChild(element)
          }

          function removeCss (element) {
            (head || document.head || document.body).removeChild(element)
          }

          function mount (cdnName) {
            var options, successCallBack, errorCallback;
            var mountArguments = arguments

            if( typeof arguments[1] === 'object' ) {
              options = arguments[1]
              successCallBack = arguments[2] || function(){}
              errorCallback = arguments[3] || function(){}
            } else {
              successCallBack = arguments[1] || function(){}
              errorCallback = arguments[2] || function(){}
            }

            options = options || {}

            // 获取cdn队列
            var cdnUrlList = cdnAssetsList[cdnName] 
            var getTimes = loadTimesMap[cdnName] === undefined ? ( loadTimesMap[cdnName] = 0 ) : loadTimesMap[cdnName]
            if( !cdnUrlList || cdnUrlList[getTimes] === undefined ) {
              console.error(cdnName + ' not found')
              errorCallback && errorCallback.call(null, loadTimesMap[cdnName])
              return 
            }
            var cdnUrl = cdnUrlList[getTimes]

            if ( cdnCache[cdnName] ) {
              successCallBack && successCallBack.apply(cdnCache[cdnName], arguments)
              return 
            }

            var successCallBackWrapper = function () {
              cdnCache[cdnName] = this
              successCallBack && successCallBack.apply(this, arguments)
            }

            if( /\\.js$/.test(cdnUrl) ) {
              loaderScript( cdnUrl, options, successCallBackWrapper, function() {
                removeScript(this)
                loadTimesMap[cdnName]++
                mount.apply(null, mountArguments)
              })
            }

            else if( /\\.css$/.test(cdnUrl) ) {
              loaderCss( cdnUrl, options, successCallBackWrapper, function() {
                removeCss(this)
                loadTimesMap[cdnName]++
                mount.apply(null, mountArguments)
              })
            }
          }

          function destroy (cdnName, successCallback, errorCallback) {
            var successCallback = successCallback || function(){}
            var errorCallback = errorCallback || function(){}
            if( cdnCache[cdnName] ) {
              var cdnUrlList = cdnAssetsList[cdnName] 
              var getTimes = loadTimesMap[cdnName] === undefined ? ( loadTimesMap[cdnName] = 0 ) : loadTimesMap[cdnName]
              if( !cdnUrlList || cdnUrlList[getTimes] === undefined ) {
                errorCallback && errorCallback.call(null)
                return
              }
              var cdnUrl = cdnUrlList[getTimes]

              function catchError(callback) {
                try {
                  callback.call(null)
                  cdnCache[cdnName] = undefined
                  successCallback.call(cdnCache[cdnName])
                } catch(e) {
                  errorCallback.call(null, e)
                }
              }

              if( /\\.js$/.test(cdnUrl) ) {
                catchError(function () {
                  removeScript(cdnCache[cdnName])
                })
              }
              else if( /\\.css$/.test(cdnUrl) ) {
                catchError(function () {
                  removeCss(cdnCache[cdnName])
                })
              }
            }else {
              errorCallback.call(null)
            }
          }

          function get (cdnName) {
            return cdnCache[cdnName]
          }

          return {
            get,
            mount,
            destroy
          }
        })();
      `
    }

    // 非内联资源 - 外部js资源
    if(!this.inlineSource) {
 
      // 非内联
      fs.writeFileSync(path.join(__dirname, PLUGIN_CORE_FILE_EXT), coreJsContent)
      compiler.options.plugins.push(new SingleEntryPlugin(undefined, path.join(__dirname, PLUGIN_CORE_FILE_EXT), PLUGIN_CORE_FILE))
    }
  

    // 注入html
    compiler.hooks.compilation.tap( pluginName, async ( compilation ) => {
      // 先检测是否存在 html-webpack-plugin 否则无法注入js,css
      const HtmlWebpackPlugin = require('html-webpack-plugin');
      if (HtmlWebpackPlugin.getHooks) {
        const hooks = HtmlWebpackPlugin.getHooks(compilation);
        const htmlPlugins = compilation.options.plugins.filter(plugin => plugin instanceof HtmlWebpackPlugin);
        if (htmlPlugins.length === 0) {
          const message = "Error running html-webpack-tags-plugin, are you sure you have html-webpack-plugin before it in your webpack config's plugins?";
          throw new Error(message);
        }
        // html webpack plugin的资源提交狗子  按资源归类
        hooks.alterAssetTags.tap(pluginName, (pluginArgs) => {
          const cdnScripts = []
          const cdnStyles = []
          if( resources) {
            resources.forEach((_url, cdnIndex) => {
              if( /\.js$/.test(_url[0]) ) {
                cdnScripts.push({
                  tagName: 'script',
                  closeTag: true,
                  attributes: {
                    type: 'text/javascript',
                    src: _url[0],
                    onerror: `__CDN_RELOAD__(this, ${cdnIndex})`
                  }
                })
              }

              if( /\.css$/.test(_url[0]) ) {
                cdnStyles.push({
                  tagName: "link",
                  selfClosingTag: false,
                  voidTag: true,
                  attributes: {
                    href: _url[0],
                    rel: "stylesheet",
                    onerror: `__CDN_RELOAD__(this, ${cdnIndex})`
                  }
                })
              }
            })
            // 将cdn资源加入队列最前端
            pluginArgs.assetTags.scripts.unshift(...cdnScripts)
            pluginArgs.assetTags.scripts.unshift(...cdnStyles)
          }
        });
        // 按 head body 归类
        hooks.alterAssetTagGroups.tapAsync(pluginName, async (pluginArgs, callback) => {
          // 压缩核心代码
          const minifyCoreJsContent = await minify(coreJsContent)
          coreJsContent = minifyCoreJsContent.code
          // 内联
          if( this.inlineSource ) {
            pluginArgs.headTags.unshift({
              tagName: 'script',
              closeTag: true,
              innerHTML: coreJsContent,
              attributes: {
                type: 'text/javascript'
              }
            })
          }else {
            // 非内联模式， 一定要保证 coreJsContent 在head的最开头执行

            // 寻找 head 和 body的script资源内 是否存在 coreJsContent
            let _index = pluginArgs.headTags.findIndex(sct => sct.tagName === 'script' && sct.attributes.src && sct.attributes.src.indexOf(PLUGIN_CORE_FILE) > -1)
            let scriptTag = null
            if( _index > -1) {
              scriptTag = pluginArgs.headTags[_index]
              pluginArgs.headTags.splice(_index, 1)
            }
            if( _index === -1) {
              _index = pluginArgs.bodyTags.findIndex(sct => sct.tagName === 'script' && sct.attributes.src && sct.attributes.src.indexOf(PLUGIN_CORE_FILE) > -1)
              if( _index > -1) {
                scriptTag = pluginArgs.bodyTags[_index]
                pluginArgs.bodyTags.splice(_index, 1)
              }
            }

            if( scriptTag ) {
              delete scriptTag.attributes.defer
              pluginArgs.headTags.unshift(scriptTag)
            }
          }
          // 执行完调用callback
          callback()
        });
      }
    })

    // 以下是正常处理资源重载
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      const { mainTemplate, runtimeTemplate } = compilation;
      mainTemplate.hooks.localVars.tap(
        pluginName,
        (source, chunk) => {
          const script = runtimeTemplate.iife('',
            `
            var getRetryDelay = ${this.chunkRetryDelay};
            // 记录所有资源的重载次数
            var retryMap = {}
            var sleep = function (delay) {
              return new Promise(function(resolve, reject) {
                setTimeout(resolve, delay)
              })
            }
            // 获取当前资源 当前 chunk的重试次数
            var getRetryTimes = function (chunkId) {
              if( retryMap[chunkId] === undefined ) {
                retryMap[chunkId] = 0
              }
              return retryMap[chunkId]
            }

            var webpackU = ${RuntimeGlobals.getChunkScriptFilename}
            var webpackMiniF = __webpack_require__.miniCssF
            // js 资源携带query
            ${RuntimeGlobals.getChunkScriptFilename} = function (chunkId) {
              var chunkIdTimes = getRetryTimes(chunkId)
              if( chunkIdTimes === 0 ) {
                return webpackU(chunkId)
              }else {
                return webpackU(chunkId) + '?reload=' + chunkIdTimes
              }
            }
            // css 资源携带query
            __webpack_require__.miniCssF = function (chunkId) {
              var chunkIdTimes = getRetryTimes(chunkId)
              if( chunkIdTimes === 0 ) {
                return webpackMiniF(chunkId)
              }else {
                return webpackMiniF(chunkId) + '?reload=' + chunkIdTimes
              }
            }


            var originPublicPath = ${RuntimeGlobals.publicPath}
            var chunkPublicpath = ${JSON.stringify(this.chunkPublicpath)}
            var publicPathpathFull = [ originPublicPath ].concat(chunkPublicpath)
            function getPublicPath(times) {
              return publicPathpathFull[ Math.min(publicPathpathFull.length - 1, times) ];
            }

            var oldWebpackE = ${RuntimeGlobals.ensureChunk}
            // 按chunk级别去重试并记录次数即可， 因为 css / js 有一个成功的话，就算第二次成功也不会再请求的，有缓存
            ${RuntimeGlobals.ensureChunk} = function (chunkId) {
              var curRetryTimes = getRetryTimes(chunkId)
              ${RuntimeGlobals.publicPath} = getPublicPath(curRetryTimes)
              var result = oldWebpackE(chunkId)
              // 一定要赋值回去，否则client 端还是会接收到catch
              result = result.catch(function(error) {
                if( curRetryTimes < ${this.maxChunkRetries} ) {
                  retryMap[chunkId]++
                  var delayTime = typeof getRetryDelay === 'function' ? getRetryDelay(curRetryTimes) : getRetryDelay;
                  return sleep(delayTime).then(function () {
                    return ${RuntimeGlobals.ensureChunk}(chunkId)
                  })
                }else {
                  throw error;
                }
              })
              return result
            }
            `
          );
          return script + ';'
        }
      );
    })
  }
}
module.exports = {
  AssetsLoadErrorDemotionWebpackPlugin
}


