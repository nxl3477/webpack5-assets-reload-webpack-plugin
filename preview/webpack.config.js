const { join } = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin');
const { AssetsLoadErrorDemotionWebpackPlugin } = require('../src/index')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const { RetryChunkLoadPlugin } = require('webpack-retry-chunk-load-plugin');

module.exports = {
  entry: join(__dirname, './test.js'),
  // mode: 'development',
  mode: 'production',
  output: {
    publicPath: "/"
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
    ]
  },
  optimization: {
    minimize: false,
    // runtimeChunk: {
    //   name: (entrypoint) => `runtime~${entrypoint.name}`,
    // },
    // splitChunks: {
    //   chunks: 'all',
    //   minSize: 3,
    //   minChunks: 1, // 默认值
    //   automaticNameDelimiter: '~',
    //   automaticNameMaxLength: 30,
    //   // 会被 chunk具体配置中的name 覆盖， 如果chunk中没有设置， 并且此处 name = true ， 会以key 替代 【name】变量占位符
    //   name: true,
    //   cacheGroups: {
    //      // 抽离node_modules 运行时依赖( 个人觉得vendor最好加上minChunk， 因为存在部分页面才用到的依赖没必要一口气加载过来)
    //     vendor: {
    //       name: "vendor",
    //       test: /[\\/]node_modules[\\/]/,
    //       chunks: "all", // 所有文件
    //       minChunks: 1, // 最少复用次数
    //       priority: 10 // 权重
    //     },
    //     // 注意: priority属性（表示权重）
    //     // 其次: 打包业务中公共代码
    //     common: {
    //       name: "common",
    //       chunks: "initial", //初始化文件
    //       minSize: 1,  // 只要超出2字节就生成一个新包
    //       reuseExistingChunk: true, // 如果已从主捆绑包中拆分出的模块，则将重用该模块，而不是生成新的模块
    //       priority: 0
    //     },
    //     async: {
    //       chunks: "async", // 异步文件
    //       reuseExistingChunk: true, // 已从主捆绑包中拆分出的模块，则将重用该模块，而不是生成新的模块
    //       minSize: 1
    //     }
    //   }
    // }
  },

  plugins: [
    new MiniCssExtractPlugin(),
    new CleanWebpackPlugin(),
    new AssetsLoadErrorDemotionWebpackPlugin({
      // inject: 'head',
      inlineSource: false,
      resources: [
        ['https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min1.css', 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'],
        ['https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.11/vue2.js', 'https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.11/vue.js'],
        ['https://cdnjs.cloudflare.com/ajax/libs/vuex/2.5.0/vuex.js', "https://cdnjs.cloudflare.com/ajax/libs/vuex/2.5.0/vuex.js"],
        ['https://cdnjs.cloudflare.com/ajax/libs/vue-router/3.0.7/vue-router.js', "https://cdnjs.cloudflare.com/ajax/libs/vue-router/3.0.7/vue-router.js"]
      ],
      dynamicResources: {
        animate: ['https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min222.css', 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'],
        vue: ['https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.11/vue2.js', 'https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.11/vue.js'],
        vuex: ['https://cdnjs.cloudflare.com/ajax/libs/vuex/2.5.0/vuex.js', "https://cdnjs.cloudflare.com/ajax/libs/vuex/2.5.0/vuex.js"],
        vueRouter: ['https://cdnjs.cloudflare.com/ajax/libs/vue-router/3.0.7/vue-router.js', "https://cdnjs.cloudflare.com/ajax/libs/vue-router/3.0.7/vue-router.js"]
      },
      chunkPublicpath: [ 'https://www.baidu.com/', 'https://www.jianshu.com/' ],
      chunkRetryDelay: function(times) {
        return times * 1000
      },
      maxChunkRetries: 3
    }),

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: join(__dirname, './index.html')
    }),


    // new RetryChunkLoadPlugin({
    //   // optional stringified function to get the cache busting query string appended to the script src
    //   // if not set will default to appending the string `?cache-bust=true`
    //   cacheBust: `function() {
    //     return Date.now();
    //   }`,
    //   // optional value to set the maximum number of retries to load the chunk. Default is 1
    //   maxRetries: 5,
    //   // optional list of chunks to which retry script should be injected
    //   // if not set will add retry script to all chunks that have webpack script loading
    //   // optional code to be executed in the browser context if after all retries chunk is not loaded.
    //   // if not set - nothing will happen and error will be returned to the chunk loader.
    //   lastResortScript: "window.location.href='/500.html'"
    // })

    

  ]
}