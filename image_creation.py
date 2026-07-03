import os
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def generate_image(prompt, output_filename=None):
    """
    Generate an image using OpenAI's DALL-E API
    
    Args:
        prompt (str): Description of the image to generate
        output_filename (str, optional): Name for the output file. 
                                        If None, uses timestamp
    
    Returns:
        str: Path to the saved image
    """
    # Get API key from environment variable
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables. "
                        "Please set it in a .env file or as an environment variable.")
    
    # API endpoint
    url = "https://api.openai.com/v1/images/generations"
    
    # Request headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Request body
    data = {
        "model": "gpt-image-1",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024"
    }
    
    print(f"Generating image for prompt: '{prompt}'...")
    
    # Make API request
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")
    
    # Get image URL from response
    image_url = response.json()['data'][0]['url']
    
    # Download the image
    image_response = requests.get(image_url)
    
    if image_response.status_code != 200:
        raise Exception(f"Failed to download image from {image_url}")
    
    # Create filename if not provided
    if output_filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"generated_image_{timestamp}.png"
    
    # Ensure filename has .png extension
    if not output_filename.endswith('.png'):
        output_filename += '.png'
    
    # Create images directory if it doesn't exist
    images_dir = os.path.join(os.path.dirname(__file__), 'images')
    os.makedirs(images_dir, exist_ok=True)
    
    # Full path for the output file
    output_path = os.path.join(images_dir, output_filename)
    
    # Save the image
    with open(output_path, 'wb') as f:
        f.write(image_response.content)
    
    print(f"✓ Image successfully saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    # Example usage
    try:
        # You can change this prompt to generate different images
        prompt = "A friendly owl programming on a laptop in a modern office, digital art style"
        
        # Generate and save the image
        saved_path = generate_image(prompt)
        
        # You can also specify a custom filename
        # saved_path = generate_image(prompt, output_filename="my_custom_image.png")
        
    except Exception as e:
        print(f"Error: {e}")

