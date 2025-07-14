#!/bin/bash

# Exit immediately if a command fails
set -e

# --- Colors for output ---
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

# --- Header ---
echo -e "${GREEN}----------------------------------------------${RESET}"
echo -e "${GREEN}         Zero-Map Installer Script            ${RESET}"
echo -e "${GREEN}----------------------------------------------${RESET}"
echo ""

# --- Update system packages ---
echo -e "${GREEN}[1/4] Updating system packages...${RESET}"
sudo apt-get update -y

# --- Install required system dependencies ---
echo -e "${GREEN}[2/4] Installing system dependencies...${RESET}"
sudo apt-get install -y build-essential libgl1-mesa-dev python3-venv python3-pip

# --- Create Python virtual environment ---
if [ ! -d "venv" ]; then
    echo -e "${GREEN}[3/4] Creating Python virtual environment...${RESET}"
    python3 -m venv venv
else
    echo -e "${YELLOW}Virtual environment already exists. Skipping creation.${RESET}"
fi

# --- Activate the virtual environment ---
echo -e "${GREEN}Activating the virtual environment...${RESET}"
source venv/bin/activate

# --- Upgrade pip in venv ---
echo -e "${GREEN}Upgrading pip in virtual environment...${RESET}"
pip install --upgrade pip

# --- Install Python dependencies in venv ---
echo -e "${GREEN}[4/4] Installing Python dependencies...${RESET}"
pip install flask pyqt5 pyqtwebengine pywebview pywebview[qt] pywifi

# --- Completion Message ---
echo ""
echo -e "${GREEN}Zero-Map setup is complete.${RESET}"
echo -e "The virtual environment has been created at: $(pwd)/venv"
echo ""
echo -e "To activate the virtual environment and run the application, use:"
echo -e "  source venv/bin/activate"
echo -e "  python3 main.py"
echo ""
