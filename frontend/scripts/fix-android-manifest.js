/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Fix debug AndroidManifest.xml
const debugManifestPath = path.join(__dirname, '../android/app/src/debug/AndroidManifest.xml');
const debugManifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <application
        android:name=".MainApplication"
        android:allowBackup="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        tools:replace="android:appComponentFactory,android:allowBackup"
        android:appComponentFactory="androidx.core.app.CoreComponentFactory"
        tools:targetApi="28"
        tools:ignore="GoogleAppIndexingWarning" />
</manifest>`;

// Fix main AndroidManifest.xml
const mainManifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
const gradlePropertiesPath = path.join(__dirname, '../android/gradle.properties');
const appBuildGradlePath = path.join(__dirname, '../android/app/build.gradle');

function fixMainManifest() {
    if (fs.existsSync(mainManifestPath)) {
        let mainManifestContent = fs.readFileSync(mainManifestPath, 'utf8');

        if (!mainManifestContent.includes('tools:replace')) {
            mainManifestContent = mainManifestContent.replace(
                /<application([^>]*)>/,
                (match, attributes) => {
                    const updatedAttributes = attributes.replace(
                        /android:appComponentFactory="androidx\.core\.app\.CoreComponentFactory"/,
                        'tools:replace="android:appComponentFactory,android:allowBackup"\n        android:appComponentFactory="androidx.core.app.CoreComponentFactory"'
                    );
                    return `<application${updatedAttributes}>`;
                }
            );
            fs.writeFileSync(mainManifestPath, mainManifestContent);
            console.log('✅ Fixed main AndroidManifest.xml');
        }
    }
}

function fixGradleProperties() {
    if (fs.existsSync(gradlePropertiesPath)) {
        let gradleContent = fs.readFileSync(gradlePropertiesPath, 'utf8');
        let modified = false;

        // Remove any existing memory settings first
        gradleContent = gradleContent.replace(/org\.gradle\.jvmargs=.*\n?/g, '');
        gradleContent = gradleContent.replace(/org\.gradle\.daemon=.*\n?/g, '');
        gradleContent = gradleContent.replace(/org\.gradle\.parallel=.*\n?/g, '');
        gradleContent = gradleContent.replace(/org\.gradle\.configureondemand=.*\n?/g, '');

        const requiredProperties = [
            'android.enableJetifier=true',
            'android.useAndroidX=true',
            'org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC',
            'org.gradle.daemon=true',
            'org.gradle.parallel=true',
            'org.gradle.configureondemand=true'
        ];

        requiredProperties.forEach(prop => {
            const propKey = prop.split('=')[0];
            if (!gradleContent.includes(propKey)) {
                gradleContent += `\n${prop}`;
                modified = true;
            }
        });

        // Remove deprecated properties
        if (gradleContent.includes('android.enableDexingArtifactTransform=false')) {
            gradleContent = gradleContent.replace(/android\.enableDexingArtifactTransform=false\n?/g, '');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(gradlePropertiesPath, gradleContent);
            console.log('✅ Enhanced gradle.properties with 8GB memory');
        }
    }
}

function fixAppBuildGradle() {
    if (!fs.existsSync(appBuildGradlePath)) {
        console.log('❌ build.gradle not found');
        return;
    }

    let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    let modified = false;

    // Add voice package DEX conflict resolution
    if (!buildGradleContent.includes('VOICE_DEX_CONFLICT_FIX')) {
        const configurationsBlock = `
// VOICE_DEX_CONFLICT_FIX - Resolve duplicate BuildConfig classes
configurations.all {
    exclude group: 'com.wenkesj', module: 'voice'
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
    }
}

`;

        const androidBlockRegex = /(\s*)(android\s*\{)/;
        if (androidBlockRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
                androidBlockRegex,
                `$1${configurationsBlock}$1$2`
            );
            modified = true;
            console.log('✅ Added voice DEX conflict resolution');
        }
    }

    // Add packaging options for duplicate classes
    if (!buildGradleContent.includes('VOICE_PACKAGING_OPTIONS')) {
        const packagingOptionsBlock = `
    // VOICE_PACKAGING_OPTIONS - Handle duplicate classes
    packagingOptions {
        pickFirst '**/BuildConfig.class'
        pickFirst '**/com/wenkesj/voice/BuildConfig.class'
        pickFirst '**/com/wenkesj/voice/BuildConfig$*.class'
        pickFirst '**/com/wenkesj/voice/R.class'
        pickFirst '**/com/wenkesj/voice/R$*.class'
        
        exclude '/META-INF/DEPENDENCIES'
        exclude '/META-INF/LICENSE'
        exclude '/META-INF/LICENSE.txt'
        exclude '/META-INF/NOTICE'
        exclude '/META-INF/NOTICE.txt'
    }

    // MEMORY_OPTIONS - Increase build memory
    dexOptions {
        javaMaxHeapSize "4g"
        preDexLibraries = false
    }
`;

        const androidBlockStart = buildGradleContent.indexOf('android {');
        if (androidBlockStart !== -1) {
            const openBraceIndex = buildGradleContent.indexOf('{', androidBlockStart);
            if (openBraceIndex !== -1) {
                const beforeAndroid = buildGradleContent.substring(0, openBraceIndex + 1);
                const afterAndroid = buildGradleContent.substring(openBraceIndex + 1);
                buildGradleContent = beforeAndroid + packagingOptionsBlock + afterAndroid;
                modified = true;
                console.log('✅ Added voice packaging options and memory settings');
            }
        }
    }

    // Add androidx.core dependency
    if (!buildGradleContent.includes("implementation 'androidx.core:core:1.13.1'")) {
        const dependenciesRegex = /(dependencies\s*\{\s*)/;
        const match = buildGradleContent.match(dependenciesRegex);

        if (match) {
            const insertPoint = match.index + match[0].length;
            const beforeDeps = buildGradleContent.substring(0, insertPoint);
            const afterDeps = buildGradleContent.substring(insertPoint);

            buildGradleContent = beforeDeps + "    implementation 'androidx.core:core:1.13.1'\n" + afterDeps;
            modified = true;
            console.log('✅ Added androidx.core dependency');
        }
    }

    if (modified) {
        fs.writeFileSync(appBuildGradlePath, buildGradleContent);
        console.log('💾 Saved build.gradle');
    }
}

function createDebugManifest() {
    const debugDir = path.dirname(debugManifestPath);
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }

    if (!fs.existsSync(debugManifestPath)) {
        fs.writeFileSync(debugManifestPath, debugManifestContent);
        console.log('✅ Created debug AndroidManifest.xml');
    }
}

async function waitForFiles(maxWaitMs = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkFiles = () => {
            if (fs.existsSync(appBuildGradlePath)) {
                resolve(true);
            } else if (Date.now() - startTime > maxWaitMs) {
                resolve(false);
            } else {
                setTimeout(checkFiles, 1000);
            }
        };
        checkFiles();
    });
}

async function main() {
    if (fs.existsSync(path.join(__dirname, '../android'))) {
        console.log('🔧 Applying Android configuration fixes...');

        // Wait for build.gradle to be generated if it doesn't exist yet
        if (!fs.existsSync(appBuildGradlePath)) {
            console.log('⏳ Waiting for build.gradle to be generated...');
            await waitForFiles();
        }

        try {
            fixMainManifest();
            fixGradleProperties();
            fixAppBuildGradle();
            createDebugManifest();

            // Clean all build artifacts to avoid memory/cache issues
            const cleanDirs = [
                path.join(__dirname, '../android/build'),
                path.join(__dirname, '../android/app/build'),
                path.join(__dirname, '../android/.gradle'),
                path.join(__dirname, '../android/app/.cxx')
            ];

            cleanDirs.forEach(dir => {
                if (fs.existsSync(dir)) {
                    try {
                        fs.rmSync(dir, { recursive: true, force: true });
                        console.log(`🧹 Cleaned ${path.basename(dir)}`);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
            });

            console.log('🎉 All Android fixes applied successfully!');
            console.log('📝 Next: cd android && ./gradlew clean && cd .. && npx expo run:android --device');
        } catch (error) {
            console.error('❌ Error applying fixes:', error.message);
            process.exit(1);
        }
    } else {
        console.log('📱 Android directory not found, skipping fixes');
    }
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});