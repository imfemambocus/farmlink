# seed_data.py
from sqlalchemy.orm import Session
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum
from core.security import get_password_hash
import random

# Password: farmlink123 (for all users)
DEFAULT_PASSWORD = "farmlink123"


def create_sample_users(db: Session):
    """Create sample users with profiles"""

    # Sample farmers
    farmers_data = [
        {
            "email": "james.farmer@gmail.com",
            "first_name": "James",
            "last_name": "Farmer",
            "phone_number": "+94771234567",
            "district": "Colombo"
        },
        {
            "email": "emily.farmer@gmail.com",
            "first_name": "Emily",
            "last_name": "Farmer",
            "phone_number": "+94772345678",
            "district": "Kandy"
        },
        {
            "email": "william.farmer@gmail.com",
            "first_name": "William",
            "last_name": "Farmer",
            "phone_number": "+94773456789",
            "district": "Galle"
        },
        {
            "email": "olivia.farmer@gmail.com",
            "first_name": "Olivia",
            "last_name": "Farmer",
            "phone_number": "+94774567890",
            "district": "Matara"
        },
        {
            "email": "benjamin.farmer@gmail.com",
            "first_name": "Benjamin",
            "last_name": "Farmer",
            "phone_number": "+94775678901",
            "district": "Jaffna"
        }
    ]

    for farmer_data in farmers_data:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == farmer_data["email"]).first()
        if existing_user:
            print(f"Farmer {farmer_data['email']} already exists, skipping...")
            continue

        # Create user
        user = User(
            email=farmer_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="farmer"
        )
        db.add(user)
        db.flush()  # Get the user ID

        # Create farmer profile
        profile = FarmerProfile(
            user_id=user.id,
            first_name=farmer_data["first_name"],
            last_name=farmer_data["last_name"],
            phone_number=farmer_data["phone_number"],
            district=farmer_data["district"]
        )
        db.add(profile)
        print(f"Created farmer: {farmer_data['first_name']} {farmer_data['last_name']}")

    # Sample individuals
    individuals_data = [
        {
            "email": "alex.thompson@gmail.com",
            "first_name": "Alex",
            "last_name": "Thompson",
            "date_of_birth": "1990-05-15",
            "phone_number": "+94776789012",
            "street": "123 Main Street",
            "city_town": "Colombo",
            "post_code": "00100"
        },
        {
            "email": "jessica.miller@gmail.com",
            "first_name": "Jessica",
            "last_name": "Miller",
            "date_of_birth": "1985-08-22",
            "phone_number": "+94777890123",
            "street": "456 Queen Street",
            "city_town": "Kandy",
            "post_code": "20000"
        },
        {
            "email": "daniel.brown@gmail.com",
            "first_name": "Daniel",
            "last_name": "Brown",
            "date_of_birth": "1992-12-03",
            "phone_number": "+94778901234",
            "street": "789 Lake Road",
            "city_town": "Galle",
            "post_code": "80000"
        }
    ]

    for individual_data in individuals_data:
        existing_user = db.query(User).filter(User.email == individual_data["email"]).first()
        if existing_user:
            print(f"Individual {individual_data['email']} already exists, skipping...")
            continue

        user = User(
            email=individual_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="individual"
        )
        db.add(user)
        db.flush()

        profile = IndividualProfile(
            user_id=user.id,
            first_name=individual_data["first_name"],
            last_name=individual_data["last_name"],
            date_of_birth=individual_data["date_of_birth"],
            phone_number=individual_data["phone_number"],
            street=individual_data["street"],
            city_town=individual_data["city_town"],
            post_code=individual_data["post_code"]
        )
        db.add(profile)
        print(f"Created individual: {individual_data['first_name']} {individual_data['last_name']}")

    # Sample businesses
    businesses_data = [
        {
            "email": "greenmart.business@gmail.com",
            "business_name": "Green Mart Supermarket",
            "contact_name": "David Business",
            "phone_number": "+94779012345",
            "street": "321 Commercial Street",
            "city_town": "Colombo",
            "post_code": "00200"
        },
        {
            "email": "freshfoods.business@gmail.com",
            "business_name": "Fresh Foods Distribution",
            "contact_name": "Sophie Business",
            "phone_number": "+94770123456",
            "street": "654 Industrial Road",
            "city_town": "Kandy",
            "post_code": "20100"
        },
        {
            "email": "organicplus.business@gmail.com",
            "business_name": "Organic Plus Store",
            "contact_name": "Michael Business",
            "phone_number": "+94771234567",
            "street": "987 Market Lane",
            "city_town": "Negombo",
            "post_code": "11500"
        }
    ]

    for business_data in businesses_data:
        existing_user = db.query(User).filter(User.email == business_data["email"]).first()
        if existing_user:
            print(f"Business {business_data['email']} already exists, skipping...")
            continue

        user = User(
            email=business_data["email"],
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="business"
        )
        db.add(user)
        db.flush()

        profile = BusinessProfile(
            user_id=user.id,
            business_name=business_data["business_name"],
            contact_name=business_data["contact_name"],
            phone_number=business_data["phone_number"],
            street=business_data["street"],
            city_town=business_data["city_town"],
            post_code=business_data["post_code"]
        )
        db.add(profile)
        print(f"Created business: {business_data['business_name']}")


def create_sample_products(db: Session):
    """Create sample products for farmers"""

    # Get all farmers (including existing ones)
    farmers = db.query(User).filter(User.role == "farmer").all()
    if not farmers:
        print("No farmers found. Create farmers first.")
        return

    # Product templates with realistic pricing
    product_templates = [
        {
            "item": ItemEnum.TOMATO,
            "description": "Fresh organic tomatoes, pesticide-free, hand-picked daily",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 350.0, "quantity_available": 100, "minimum_order": 1},
                {"unit": UnitEnum.BASKET, "price_per_unit": 1400.0, "quantity_available": 25, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.CARROT,
            "description": "Premium highland carrots, sweet and crunchy",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 280.0, "quantity_available": 80, "minimum_order": 2},
                {"unit": UnitEnum.BUNCH, "price_per_unit": 150.0, "quantity_available": 50, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.BANANA,
            "description": "Sweet Cavendish bananas, perfectly ripened",
            "unit_prices": [
                {"unit": UnitEnum.DOZEN, "price_per_unit": 180.0, "quantity_available": 40, "minimum_order": 1},
                {"unit": UnitEnum.BUNCH, "price_per_unit": 450.0, "quantity_available": 20, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.POTATO,
            "description": "High-quality potatoes, perfect for cooking",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 200.0, "quantity_available": 150, "minimum_order": 5},
                {"unit": UnitEnum.BASKET, "price_per_unit": 2000.0, "quantity_available": 15, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.ONION,
            "description": "Fresh red onions, strong flavor and aroma",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 300.0, "quantity_available": 120, "minimum_order": 2},
                {"unit": UnitEnum.BASKET, "price_per_unit": 2400.0, "quantity_available": 20, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.CABBAGE,
            "description": "Crispy fresh cabbage, ideal for salads and cooking",
            "unit_prices": [
                {"unit": UnitEnum.PIECE, "price_per_unit": 150.0, "quantity_available": 60, "minimum_order": 1},
                {"unit": UnitEnum.KG, "price_per_unit": 120.0, "quantity_available": 80, "minimum_order": 3}
            ]
        },
        {
            "item": ItemEnum.APPLE,
            "description": "Imported fresh apples, crispy and sweet",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 650.0, "quantity_available": 30, "minimum_order": 1},
                {"unit": UnitEnum.PIECE, "price_per_unit": 80.0, "quantity_available": 200, "minimum_order": 5}
            ]
        },
        {
            "item": ItemEnum.MANGO,
            "description": "Local ripe mangoes, naturally sweet and juicy",
            "unit_prices": [
                {"unit": UnitEnum.PIECE, "price_per_unit": 120.0, "quantity_available": 100, "minimum_order": 3},
                {"unit": UnitEnum.DOZEN, "price_per_unit": 1200.0, "quantity_available": 15, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.LETTUCE,
            "description": "Fresh green lettuce, perfect for salads",
            "unit_prices": [
                {"unit": UnitEnum.PIECE, "price_per_unit": 100.0, "quantity_available": 40, "minimum_order": 2},
                {"unit": UnitEnum.KG, "price_per_unit": 400.0, "quantity_available": 25, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.BELL_PEPPER,
            "description": "Colorful bell peppers, rich in vitamins",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 500.0, "quantity_available": 35, "minimum_order": 1},
                {"unit": UnitEnum.PIECE, "price_per_unit": 75.0, "quantity_available": 80, "minimum_order": 4}
            ]
        },
        {
            "item": ItemEnum.CUCUMBER,
            "description": "Fresh cucumbers, great for salads and cooking",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 180.0, "quantity_available": 70, "minimum_order": 2},
                {"unit": UnitEnum.PIECE, "price_per_unit": 25.0, "quantity_available": 150, "minimum_order": 5}
            ]
        },
        {
            "item": ItemEnum.SPINACH,
            "description": "Organic spinach leaves, rich in iron and nutrients",
            "unit_prices": [
                {"unit": UnitEnum.BUNCH, "price_per_unit": 80.0, "quantity_available": 60, "minimum_order": 2},
                {"unit": UnitEnum.KG, "price_per_unit": 320.0, "quantity_available": 20, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.PINEAPPLE,
            "description": "Sweet tropical pineapples, freshly harvested",
            "unit_prices": [
                {"unit": UnitEnum.PIECE, "price_per_unit": 250.0, "quantity_available": 30, "minimum_order": 1},
                {"unit": UnitEnum.KG, "price_per_unit": 300.0, "quantity_available": 40, "minimum_order": 2}
            ]
        },
        {
            "item": ItemEnum.COCONUT,
            "description": "Fresh coconuts with sweet water and meat",
            "unit_prices": [
                {"unit": UnitEnum.PIECE, "price_per_unit": 100.0, "quantity_available": 80, "minimum_order": 3},
                {"unit": UnitEnum.DOZEN, "price_per_unit": 1000.0, "quantity_available": 10, "minimum_order": 1}
            ]
        },
        {
            "item": ItemEnum.EGGPLANT,
            "description": "Purple eggplants, perfect for curries and stir-fries",
            "unit_prices": [
                {"unit": UnitEnum.KG, "price_per_unit": 220.0, "quantity_available": 50, "minimum_order": 2},
                {"unit": UnitEnum.PIECE, "price_per_unit": 40.0, "quantity_available": 100, "minimum_order": 5}
            ]
        }
    ]

    for farmer in farmers:
        print(f"Creating products for farmer: {farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}")

        # Randomly select 5-7 products for each farmer
        selected_products = random.sample(product_templates, random.randint(5, 7))

        for product_data in selected_products:
            # Check if farmer already has this product
            existing_product = db.query(FarmerProduct).filter(
                FarmerProduct.farmer_id == farmer.id,
                FarmerProduct.item == product_data["item"]
            ).first()

            if existing_product:
                print(f"  - {product_data['item'].value} already exists, skipping...")
                continue

            # Create product with slight price variation per farmer
            price_variation = random.uniform(0.9, 1.1)  # ±10% price variation

            product = FarmerProduct(
                farmer_id=farmer.id,
                item=product_data["item"],
                description=product_data["description"],
                is_active=True
            )
            db.add(product)
            db.flush()

            # Add unit prices with variation
            for up_data in product_data["unit_prices"]:
                unit_price = ProductUnitPrice(
                    farmer_product_id=product.id,
                    unit=up_data["unit"],
                    price_per_unit=round(up_data["price_per_unit"] * price_variation, 2),
                    quantity_available=up_data["quantity_available"] + random.randint(-10, 20),
                    minimum_order=up_data["minimum_order"]
                )
                db.add(unit_price)

            print(f"  + Created {product_data['item'].value}")


def seed_database():
    """Main seeding function"""
    print("=" * 50)
    print("🌱 Starting FarmLink database seeding...")
    print("=" * 50)

    # Create database session
    db = SessionLocal()
    try:
        print("\n📧 Creating sample users...")
        create_sample_users(db)

        print("\n🥕 Creating sample products...")
        create_sample_products(db)

        db.commit()
        print("\n" + "=" * 50)
        print("✅ Database seeding completed successfully!")
        print("=" * 50)
        print(f"🔑 Default password for all users: {DEFAULT_PASSWORD}")
        print("=" * 50)

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()