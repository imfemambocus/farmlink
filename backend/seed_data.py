# seed_data.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from core.security import get_password_hash
import random

# Password: farmlink123 (for all users)
DEFAULT_PASSWORD = "farmlink123"


def reset_database(db: Session):
    """Reset database by dropping all data and recreating tables"""
    print("🗑️  Resetting database...")

    try:
        # Import Base to access metadata
        from core.database import Base

        # Drop all tables
        print("  - Dropping all existing tables...")
        Base.metadata.drop_all(bind=engine)

        # Recreate all tables with updated schema
        print("  - Creating tables with updated schema...")
        Base.metadata.create_all(bind=engine)

        db.commit()
        print("✅ Database reset and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


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
    """Create sample products for farmers with individual and business pricing"""

    farmers = db.query(User).filter(User.role == "farmer").all()
    if not farmers:
        print("No farmers found. Create farmers first.")
        return

    # Product templates with separate individual and business pricing
    product_templates = [
        {
            "item": ItemEnum.TOMATO,
            "description": "Fresh organic tomatoes, pesticide-free, hand-picked daily",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 350.0, "quantity": 100, "minimum": 1},
                    "business": {"price": 320.0, "quantity": 500, "minimum": 25}
                },
                {
                    "unit": UnitEnum.BASKET,
                    "individual": {"price": 1400.0, "quantity": 25, "minimum": 1},
                    "business": {"price": 1250.0, "quantity": 100, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.CARROT,
            "description": "Premium highland carrots, sweet and crunchy",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 280.0, "quantity": 80, "minimum": 2},
                    "business": {"price": 250.0, "quantity": 400, "minimum": 25}
                },
                {
                    "unit": UnitEnum.BUNCH,
                    "individual": {"price": 150.0, "quantity": 50, "minimum": 1},
                    "business": {"price": 130.0, "quantity": 200, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.BANANA,
            "description": "Sweet Cavendish bananas, perfectly ripened",
            "pricing": [
                {
                    "unit": UnitEnum.DOZEN,
                    "individual": {"price": 180.0, "quantity": 40, "minimum": 1},
                    "business": {"price": 160.0, "quantity": 200, "minimum": 25}
                },
                {
                    "unit": UnitEnum.BUNCH,
                    "individual": {"price": 450.0, "quantity": 20, "minimum": 1},
                    "business": {"price": 400.0, "quantity": 100, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.POTATO,
            "description": "High-quality potatoes, perfect for cooking",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 200.0, "quantity": 150, "minimum": 5},
                    "business": {"price": 180.0, "quantity": 1000, "minimum": 50}
                },
                {
                    "unit": UnitEnum.BASKET,
                    "individual": {"price": 2000.0, "quantity": 15, "minimum": 1},
                    "business": {"price": 1800.0, "quantity": 80, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.ONION,
            "description": "Fresh red onions, strong flavor and aroma",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 300.0, "quantity": 120, "minimum": 2},
                    "business": {"price": 270.0, "quantity": 600, "minimum": 25}
                },
                {
                    "unit": UnitEnum.BASKET,
                    "individual": {"price": 2400.0, "quantity": 20, "minimum": 1},
                    "business": {"price": 2200.0, "quantity": 100, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.CABBAGE,
            "description": "Crispy fresh cabbage, ideal for salads and cooking",
            "pricing": [
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 150.0, "quantity": 60, "minimum": 1},
                    "business": {"price": 130.0, "quantity": 300, "minimum": 25}
                },
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 120.0, "quantity": 80, "minimum": 3},
                    "business": {"price": 100.0, "quantity": 400, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.APPLE,
            "description": "Imported fresh apples, crispy and sweet",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 650.0, "quantity": 30, "minimum": 1},
                    "business": {"price": 600.0, "quantity": 200, "minimum": 25}
                },
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 80.0, "quantity": 200, "minimum": 5},
                    "business": {"price": 70.0, "quantity": 1000, "minimum": 50}
                }
            ]
        },
        {
            "item": ItemEnum.MANGO,
            "description": "Local ripe mangoes, naturally sweet and juicy",
            "pricing": [
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 120.0, "quantity": 100, "minimum": 3},
                    "business": {"price": 100.0, "quantity": 500, "minimum": 25}
                },
                {
                    "unit": UnitEnum.DOZEN,
                    "individual": {"price": 1200.0, "quantity": 15, "minimum": 1},
                    "business": {"price": 1000.0, "quantity": 75, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.LETTUCE,
            "description": "Fresh green lettuce, perfect for salads",
            "pricing": [
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 100.0, "quantity": 40, "minimum": 2},
                    "business": {"price": 85.0, "quantity": 200, "minimum": 25}
                },
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 400.0, "quantity": 25, "minimum": 1},
                    "business": {"price": 350.0, "quantity": 150, "minimum": 25}
                }
            ]
        },
        {
            "item": ItemEnum.BELL_PEPPER,
            "description": "Colorful bell peppers, rich in vitamins",
            "pricing": [
                {
                    "unit": UnitEnum.KG,
                    "individual": {"price": 500.0, "quantity": 35, "minimum": 1},
                    "business": {"price": 450.0, "quantity": 200, "minimum": 25}
                },
                {
                    "unit": UnitEnum.PIECE,
                    "individual": {"price": 75.0, "quantity": 80, "minimum": 4},
                    "business": {"price": 65.0, "quantity": 400, "minimum": 25}
                }
            ]
        }
    ]

    for farmer in farmers:
        print(f"Creating products for farmer: {farmer.farmer_profile.first_name} {farmer.farmer_profile.last_name}")

        # Randomly select 5-7 products for each farmer
        selected_products = random.sample(product_templates, random.randint(5, 7))

        for product_data in selected_products:
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

            # Add individual and business pricing for each unit
            for pricing_data in product_data["pricing"]:
                # Individual pricing
                individual_unit_price = ProductUnitPrice(
                    farmer_product_id=product.id,
                    unit=pricing_data["unit"],
                    customer_type=CustomerTypeEnum.INDIVIDUAL,
                    price_per_unit=round(pricing_data["individual"]["price"] * price_variation, 2),
                    quantity_available=pricing_data["individual"]["quantity"] + random.randint(-10, 20),
                    minimum_order=pricing_data["individual"]["minimum"]
                )
                db.add(individual_unit_price)

                # Business pricing
                business_unit_price = ProductUnitPrice(
                    farmer_product_id=product.id,
                    unit=pricing_data["unit"],
                    customer_type=CustomerTypeEnum.BUSINESS,
                    price_per_unit=round(pricing_data["business"]["price"] * price_variation, 2),
                    quantity_available=pricing_data["business"]["quantity"] + random.randint(-50, 100),
                    minimum_order=pricing_data["business"]["minimum"]
                )
                db.add(business_unit_price)

            print(f"  + Created {product_data['item'].value} (individual & business pricing)")


def seed_database():
    """Main seeding function"""
    print("=" * 50)
    print("🌱 Starting FarmLink database seeding...")
    print("=" * 50)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database first
        reset_database(db)

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
        print("👥 Test accounts:")
        print("  Individual: alex.thompson@gmail.com")
        print("  Business: greenmart.business@gmail.com")
        print("  Farmer: james.farmer@gmail.com")
        print("=" * 50)

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()