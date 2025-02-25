import os
import requests
from PIL import Image
from io import BytesIO

def download_and_save_card(card_name):
    url = f"https://opengameart.org/sites/default/files/styles/medium/public/cards-{card_name}.png"
    response = requests.get(url)
    if response.status_code == 200:
        img = Image.open(BytesIO(response.content))
        img.save(f"public/images/cards/{card_name}.png")
        print(f"Downloaded {card_name}")
    else:
        print(f"Failed to download {card_name}")

# Create directory if it doesn't exist
os.makedirs("public/images/cards", exist_ok=True)

# Download specific cards we need
cards = ["king_of_spades", "king_of_hearts"]
for card in cards:
    download_and_save_card(card)
