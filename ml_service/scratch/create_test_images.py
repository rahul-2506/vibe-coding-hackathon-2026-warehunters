from PIL import Image, ImageDraw, ImageFont
import os

def create_text_image(text, filename):
    # Create a white image
    img = Image.new('RGB', (800, 200), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    
    # Use default font if custom font not found
    try:
        # Try to find a common font
        font = ImageFont.truetype("arial.ttf", 60)
    except:
        font = ImageFont.load_default()
        
    # Draw text in black
    d.text((50, 60), text, fill=(0, 0, 0), font=font)
    
    # Save it
    path = os.path.join(os.getcwd(), 'scratch', filename)
    img.save(path)
    print(f"Created: {path}")

# Ensure scratch dir exists
if not os.path.exists('scratch'):
    os.makedirs('scratch')

create_text_image("The Derma Co 1% Salicylic Acid", "test_derma.png")
create_text_image("Himalaya Purifying Neem Facewash", "test_himalaya.png")
create_text_image("Mamaearth Ubtan Face Wash", "test_mamaearth.png")
