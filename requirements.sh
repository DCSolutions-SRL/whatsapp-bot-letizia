#!/bin/bash

# Instalar dependencias desde el requirements.txt
while read -r package; do
  sudo apt install -y "$package"
done < requirements.txt
