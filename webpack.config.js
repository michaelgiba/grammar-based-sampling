const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // Use 'production' for builds
  entry: './src/index.ts', // Changed entry point to .ts
  devtool: 'inline-source-map', // For easier debugging
  devServer: {
    static: [
      { directory: path.join(__dirname, 'dist') }, // Serve files from dist
      { directory: path.join(__dirname, 'data'), publicPath: '/data' }, // Serve files from data under /data URL path
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Grammar-Based Sampling Visualizations',
      template: './dist/index.html', // Use our html file as template
    }),
  ],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Clean the dist folder before each build
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Add rule for .ts and .tsx files
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'], // Add .ts and .tsx to resolvable extensions
  },
};
