#!/bin/bash

# Script para instalar todas las dependencias necesarias para el monitor de Letizia

echo "================================"
echo "Instalador de Letizia Monitor"
echo "================================"

# Función para verificar si un comando existe
command_exists() {
  command -v "$1" &> /dev/null
}

# Lista de paquetes requeridos para Puppeteer/WhatsApp Web
PACKAGES=(
  "libatk1.0-0"
  "libx11-xcb1"
  "libnss3"
  "libxcomposite1"
  "libxcursor1"
  "libxdamage1"
  "libxfixes3"
  "libxi6"
  "libxrandr2"
  "libgtk-3-0"
  "libgbm1"
  "libxext6"
  "libxrender1"
  "libxtst6"
  "libglib2.0-0"
  "libdbus-glib-1-2"
  "libasound2"
  "libatk-bridge2.0-0"
  "libcups2"
  "libxkbcommon0"
  "libpangocairo-1.0-0"
)

# Función para verificar e instalar Node.js si no está instalado
install_nodejs() {
  if ! command_exists node; then
    echo "Node.js no está instalado. Instalando..."
    
    # Verificar si curl está instalado
    if ! command_exists curl; then
      echo "Instalando curl..."
      sudo apt update
      sudo apt install -y curl
    fi
    
    # Instalar Node.js 16.x
    echo "Configurando repositorio de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    
    echo "Instalando Node.js..."
    sudo apt install -y nodejs
    
    # Verificar instalación
    node_version=$(node -v)
    echo "Node.js instalado: $node_version"
  else
    node_version=$(node -v)
    echo "Node.js ya está instalado: $node_version"
  fi

  # Verificar que npm está instalado
  if ! command_exists npm; then
    echo "ERROR: npm no está instalado correctamente."
    exit 1
  else
    npm_version=$(npm -v)
    echo "npm instalado: $npm_version"
  fi
}

# Función principal
main() {
  # Actualizar los repositorios
  echo "Actualizando repositorios..."
  sudo apt update

  # Instalar cada paquete
  echo "Instalando dependencias del sistema..."
  for package in "${PACKAGES[@]}"; do
    echo "Instalando $package..."
    sudo apt install -y "$package"
    if [ $? -ne 0 ]; then
      echo "ERROR: No se pudo instalar $package"
    fi
  done

  # Instalar Node.js si es necesario
  install_nodejs

  # Crear estructura de directorios
  echo "Creando estructura de directorios..."
  mkdir -p logs
  mkdir -p services
  mkdir -p utils

  # Instalar dependencias de npm
  echo "Instalando dependencias de npm..."
  npm install

  echo "Configurando permisos..."
  chmod +x *.sh

  echo "¡Instalación completada!"
  echo "Para ejecutar el monitor en modo prueba: npm test"
  echo "Para ejecutar el monitor programado: npm start"
  echo "Para verificar la configuración: npm run debug"
}

# Ejecutar función principal
main "$@"
exit 0
