# LocalZero

LocalZero is an experimental, v0-like app builder for development with local agents. It is very early in development and should be treated as a prototype, not a finished product.

The app gives you a local workspace where you can describe what you want to build, pick an Ollama model, and let a local agent scaffold and edit projects on your machine.

## What You Need

- Node.js
- npm
- Ollama running locally
- At least one local Ollama model installed

## Run It

Install dependencies:

```sh
npm install
```

Start LocalZero:

```sh
npm run dev
```

Open the local URL shown in your terminal. The app will use the local Ollama server and store generated projects under:

```sh
~/.localzero/projects
```

You can override that location with `PROJECTS_DIR`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License. See [LICENSE](LICENSE) for details.
