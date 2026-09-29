import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import webpack from 'webpack';
import type { Configuration } from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { siteConfig } from './build/site-config.mts';
import { notFoundPage, pageTemplateData } from './build/page-metadata.mts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default (_env: unknown, argv: { mode?: Configuration['mode'] }): Configuration & { devServer: DevServerConfiguration } => {
  const production = argv.mode === 'production';
  const site = siteConfig();
  const publicRoutes = new Set(site.routes.map((route) => `${site.basePath}${route.slice(1)}`));
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }

  return {
    context: root,
    entry: { app: './src/app/app.ts' },
    target: ['web', 'es2022'],
    output: {
      path: fileURLToPath(new URL('dist/', import.meta.url)),
      filename: 'assets/[name].[contenthash:8].js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
      publicPath: site.basePath,
      clean: true,
    },
    devtool: production ? false : 'source-map',
    resolve: { extensionAlias: { '.js': ['.ts', '.js'] } },
    module: {
      rules: [
        {
          test: /\.ts$/i,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.app.json',
              compilerOptions: { noEmit: false, rewriteRelativeImportExtensions: true },
            },
          },
        },
        { test: /\.css$/i, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
        { test: /\.(png|jpe?g|gif|svg|webp|ico|woff2?)$/i, type: 'asset/resource' },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
      }),
      new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash:8].css' }),
      ...site.routes.map((route) => new HtmlWebpackPlugin({
        filename: `${route.slice(1)}index.html`,
        template: './src/html/index.html',
        page: pageTemplateData(route, site),
        scriptLoading: 'defer',
      })),
      new HtmlWebpackPlugin({
        filename: '404.html',
        templateContent: notFoundPage(site.basePath),
        inject: false,
      }),
      new CopyPlugin({ patterns: [
        { from: 'src/assets', to: 'assets' },
        { from: 'LICENSE', to: 'LICENSE', toType: 'file' },
        { from: 'public/.nojekyll', to: '.nojekyll', toType: 'file' },
        { from: 'node_modules/vue/LICENSE', to: 'licenses/vue.txt' },
        { from: '@vue/*/LICENSE', to: 'licenses/[path][name]', context: 'node_modules' },
        { from: 'node_modules/marked/LICENSE', to: 'licenses/marked.txt' },
        { from: 'node_modules/dompurify/LICENSE', to: 'licenses/dompurify.txt' },
      ] }),
    ],
    optimization: {
      minimizer: ['...', new CssMinimizerPlugin()],
      splitChunks: { chunks: 'all' },
    },
    devServer: {
      host: process.env.HOST ?? '127.0.0.1',
      port,
      static: false,
      historyApiFallback: false,
      hot: false,
      liveReload: true,
      client: { overlay: { errors: true, warnings: false } },
      setupMiddlewares(middlewares) {
        middlewares.unshift({
          name: 'canonical-page-paths',
          middleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
            const url = new URL(request.url ?? '/', 'http://localhost');
            if (['GET', 'HEAD'].includes(request.method ?? '') && !url.pathname.endsWith('/') &&
                publicRoutes.has(`${url.pathname}/`)) {
              response.writeHead(308, { Location: `${url.pathname}/${url.search}` });
              response.end();
              return;
            }
            next();
          },
        });
        return middlewares;
      },
    },
  };
};
