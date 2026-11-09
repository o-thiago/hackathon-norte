{
  description = "Plataforma Centralizada de Qualidade, Normalização e Gestão de Dados - SETIC/CAGD";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-parts,
      systems,
      git-hooks,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import systems;
      perSystem =
        {
          config,
          self',
          inputs',
          pkgs,
          system,
          ...
        }:
        let
          packageJSON =
            if builtins.pathExists ./package.json then
              builtins.fromJSON (builtins.readFile ./package.json)
            else
              { };

          pname = packageJSON.name or "sentinela-das-aguas";
          version = packageJSON.version or "0.1.0";

          pre-commit-check = git-hooks.lib.${system}.run {
            src = ./.;
            excludes = [
              "^bun\\.lock$"
            ];
            hooks = {
              # Formatters
              prettier = {
                enable = true;
                excludes = [ "^bun\\.lock$" ];
              };

              # Linters & Static Analysis
              # biome.enable = true; # Fast all-in-one linter/formatter alternative
              # eslint.enable = true; # ESLint (enable when configured in workspace)

              # Hygiene
              trim-trailing-whitespace.enable = true;
              end-of-file-fixer = {
                enable = true;
                excludes = [ "^bun\\.lock$" ];
              };
              check-yaml.enable = true;
              check-json = {
                enable = true;
                excludes = [ "^bun\\.lock$" ];
              };
            };
          };
        in
        {
          _module.args.pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };

          checks = {
            inherit pre-commit-check;
            package = self'.packages.default;
          };

          packages.default = pkgs.stdenv.mkDerivation {
            inherit pname version;
            src = ./.;
            nativeBuildInputs = with pkgs; [
              bun
              nodejs_22
            ];
            buildPhase = "true";
            installPhase = ''
              mkdir -p $out/lib
              cp -r api web package.json $out/lib/ 2>/dev/null || true
              [ -f bun.lock ] && cp bun.lock $out/lib/ || true
            '';
          };

          devShells.default = pkgs.mkShell {
            name = "${pname}-devshell";

            packages =
              (with pkgs; [
                bun
                nodejs_22
                typescript
                podman
                podman-compose
              ])
              ++ pre-commit-check.enabledPackages;

            env = {
              DATABASE_URL = "postgres://postgres:postgres@localhost:5432/hackathon_db";
              LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (with pkgs; [
                stdenv.cc.cc.lib
                zlib
              ]);
            };

            shellHook = ''
              ${pre-commit-check.shellHook}
              [ -d "node_modules/.bin" ] && export PATH="$PWD/node_modules/.bin:$PATH"
              echo "==============================================="
              echo "🚀 ${pname} development shell loaded!"
              echo "   Bun:            $(bun --version 2>/dev/null || echo 'not found')"
              echo "   Node:           $(node --version 2>/dev/null || echo 'not found')"
              echo "   Podman:         $(podman --version 2>/dev/null || echo 'not found')"
              echo "==============================================="
            '';
          };
        };
    };
}
