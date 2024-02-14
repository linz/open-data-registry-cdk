let
  sources = import ./nix/sources.nix;
  pkgs = import sources.nixpkgs {};
in
  pkgs.mkShell {
    packages = [
      pkgs.bashInteractive
      pkgs.nodejs
    ];
    shellHook = ''
      ln --force --symbolic "${pkgs.nodejs}/bin/node" .
    '';
  }
