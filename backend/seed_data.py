# seed_data.py - UPDATED FOR ML TESTING
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from core.security import get_password_hash
from datetime import datetime, timedelta
from decimal import Decimal

# Password: test (for all test users)
DEFAULT_PASSWORD = "test"


def reset_database(db: Session):
    """Reset database and create all tables with updated schema"""
    print("🗑️  Resetting database...")

    try:
        # Import Base to access metadata
        from core.database import Base

        # STEP 1: Get all existing tables from database
        print("  - Scanning existing tables...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))
        existing_tables = [row[0] for row in result]
        print(f"    Found {len(existing_tables)} existing tables")

        # STEP 2: Get all model tables from current models
        model_tables = set(Base.metadata.tables.keys())
        print(f"    Current models define {len(model_tables)} tables")

        # STEP 3: Find orphaned tables (exist in DB but not in models)
        orphaned_tables = set(existing_tables) - model_tables
        if orphaned_tables:
            print(f"  - Removing {len(orphaned_tables)} orphaned tables...")
            for table in orphaned_tables:
                try:
                    db.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    print(f"    ✅ Removed orphaned table: {table}")
                except Exception as e:
                    print(f"    ⚠️  Could not remove {table}: {e}")

        # STEP 4: Drop all remaining tables to ensure clean slate
        print("  - Dropping all remaining tables...")
        Base.metadata.drop_all(bind=engine)

        # STEP 5: Create all tables from current models
        print("  - Creating tables from current models...")
        Base.metadata.create_all(bind=engine)

        # STEP 6: Verify final table structure
        print("  - Verifying final table structure...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))

        final_tables = [row[0] for row in result]
        print(f"    📋 Final database has {len(final_tables)} tables")

        db.commit()
        print("✅ Database cleanup and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


def create_test_users(db: Session):
    """Create simple test users for ML testing"""

    # Test Individual User
    individual_user = User(
        email="user@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="individual"
    )
    db.add(individual_user)
    db.flush()

    individual_profile = IndividualProfile(
        user_id=individual_user.id,
        first_name="Test",
        last_name="User",
        date_of_birth="1990-01-01",
        phone_number="+94701234567",
        street="123 Test Street",
        city_town="Colombo",
        post_code="00100"
    )
    db.add(individual_profile)
    print("Created individual user: user@test.com")

    # Test Business User
    business_user = User(
        email="biz@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="business"
    )
    db.add(business_user)
    db.flush()

    business_profile = BusinessProfile(
        user_id=business_user.id,
        business_name="Test Business",
        contact_name="Biz User",
        phone_number="+94702345678",
        street="456 Business Road",
        city_town="Kandy",
        post_code="20000"
    )
    db.add(business_profile)
    print("Created business user: biz@test.com")

    # Test Farmer User (with ALL products)
    farmer_user = User(
        email="farm@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="farmer"
    )
    db.add(farmer_user)
    db.flush()

    farmer_profile = FarmerProfile(
        user_id=farmer_user.id,
        first_name="Farm",
        last_name="User",
        phone_number="+94703456789",
        district="Galle"
    )
    db.add(farmer_profile)
    print("Created farmer user: farm@test.com")

    return farmer_user.id


def create_all_products(db: Session, farmer_id: int):
    """Create ALL fruits and vegetables for the test farmer"""

    # Define realistic pricing for all items
    product_pricing = {
        # FRUITS
        ItemEnum.APPLE: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.BANANA: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.DOZEN, "stock": 80},
        ItemEnum.ORANGE: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.MANGO: {"individual": 500.0, "business": 450.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.PINEAPPLE: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.PIECE, "stock": 40},
        ItemEnum.PAPAYA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GUAVA: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.LYCHEE: {"individual": 600.0, "business": 550.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.COCONUT: {"individual": 80.0, "business": 70.0, "unit": UnitEnum.PIECE, "stock": 100},
        ItemEnum.LEMON: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.LIME: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.WATERMELON: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.MELON: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GRAPES: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 25},
        ItemEnum.STRAWBERRY: {"individual": 1200.0, "business": 1000.0, "unit": UnitEnum.KG, "stock": 15},

        # VEGETABLES
        ItemEnum.TOMATO: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 120},
        ItemEnum.POTATO: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 200},
        ItemEnum.ONION: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 150},
        ItemEnum.CARROT: {"individual": 280.0, "business": 250.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.CABBAGE: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.PIECE, "stock": 80},
        ItemEnum.LETTUCE: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.PIECE, "stock": 60},
        ItemEnum.SPINACH: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.BUNCH, "stock": 70},
        ItemEnum.BROCCOLI: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.CAULIFLOWER: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.PIECE, "stock": 50},
        ItemEnum.BELL_PEPPER: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.CHILI: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.CUCUMBER: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.EGGPLANT: {"individual": 220.0, "business": 200.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.OKRA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GREEN_BEANS: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.PUMPKIN: {"individual": 120.0, "business": 100.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.BEETROOT: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.RADISH: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.GINGER: {"individual": 600.0, "business": 540.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.GARLIC: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
    }

    print(f"Creating ALL {len(product_pricing)} products for test farmer...")

    for item_enum, pricing in product_pricing.items():
        # Create product
        product = FarmerProduct(
            farmer_id=farmer_id,
            item=item_enum,
            description=f"Fresh organic {item_enum.value.replace('_', ' ')}, pesticide-free",
            is_active=True,
            harvest_date=datetime.now() - timedelta(days=1),
            expiry_date=datetime.now() + timedelta(days=10)
        )
        db.add(product)
        db.flush()

        # Individual pricing
        individual_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.INDIVIDUAL,
            price_per_unit=pricing["individual"],
            quantity_available=pricing["stock"],
            minimum_order=1
        )
        db.add(individual_unit_price)

        # Business pricing (bulk orders)
        business_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.BUSINESS,
            price_per_unit=pricing["business"],
            quantity_available=pricing["stock"] * 2,  # More stock for business
            minimum_order=25 if pricing["unit"] != UnitEnum.PIECE else 10  # Bulk minimum
        )
        db.add(business_unit_price)

        print(
            f"  ✅ Created {item_enum.value} (Individual: Rs {pricing['individual']}, Business: Rs {pricing['business']})")


def seed_database():
    """Main seeding function for ML testing"""
    print("=" * 60)
    print("🧪 Starting FarmLink ML Testing Database Setup...")
    print("=" * 60)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database
        reset_database(db)

        print("\n👥 Creating test users...")
        farmer_id = create_test_users(db)

        print(f"\n🥕 Creating ALL products for test farmer (ID: {farmer_id})...")
        create_all_products(db, farmer_id)

        # NO carts, NO orders - clean slate for ML testing

        db.commit()
        print("\n" + "=" * 60)
        print("✅ ML Testing Database Setup Completed!")
        print("=" * 60)
        print(f"🔑 Password for all users: {DEFAULT_PASSWORD}")
        print("=" * 60)
        print("🧪 Test accounts for ML:")
        print("  👤 Individual: user@test.com")
        print("  🏢 Business: biz@test.com")
        print("  🚜 Farmer: farm@test.com")
        print("=" * 60)
        print("📋 Products available:")
        print("  🍎 15 Fruits (apple, banana, orange, mango, etc.)")
        print("  🥕 20 Vegetables (tomato, potato, onion, carrot, etc.)")
        print("  💰 Individual & Business pricing for all items")
        print("=" * 60)
        print("🎯 Ready for ML Testing:")
        print("  1. Login as user@test.com or biz@test.com")
        print("  2. Order diverse products from farm@test.com")
        print("  3. Test ML recommendations on homepage")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()