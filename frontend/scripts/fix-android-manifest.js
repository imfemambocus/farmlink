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

// Fix gradle.properties
const gradlePropertiesPath = path.join(__dirname, '../android/gradle.properties');

// Fix app/build.gradle
const appBuildGradlePath = path.join(__dirname, '../android/app/build.gradle');

// Function to fix main manifest
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

// Function to fix gradle.properties
function fixGradleProperties() {
    if (fs.existsSync(gradlePropertiesPath)) {
        let gradleContent = fs.readFileSync(gradlePropertiesPath, 'utf8');

        // Add jetifier if not present
        if (!gradleContent.includes('android.enableJetifier=true')) {
            gradleContent += '\n# Force AndroidX compatibility\nandroid.enableJetifier=true\n';
            fs.writeFileSync(gradlePropertiesPath, gradleContent);
            console.log('✅ Added android.enableJetifier=true to gradle.properties');
        }
    }
}

// Function to fix app/build.gradle
function fixAppBuildGradle() {
    if (fs.existsSync(appBuildGradlePath)) {
        let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');

        // Add configurations.all block if not present
        const configurationsBlock = `
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        eachDependency { details ->
            if (details.requested.group == 'com.android.support') {
                details.useTarget group: 'androidx.legacy', name: 'legacy-support-v4', version: '1.0.0'
            }
        }
    }
}
`;

        if (!buildGradleContent.includes('configurations.all')) {
            // Find the android block and add configurations before it
            buildGradleContent = buildGradleContent.replace(
                /android\s*{/,
                `${configurationsBlock}\nandroid {`
            );
            console.log('✅ Added configurations.all block to app/build.gradle');
        }

        // Add androidx.core dependency if not present
        if (!buildGradleContent.includes("implementation 'androidx.core:core:1.13.1'")) {
            // Find the dependencies block
            buildGradleContent = buildGradleContent.replace(
                /(dependencies\s*{[^}]*)/,
                `$1    implementation 'androidx.core:core:1.13.1'\n`
            );
            console.log('✅ Added androidx.core:core:1.13.1 to dependencies');
        }

        fs.writeFileSync(appBuildGradlePath, buildGradleContent);
    }
}

// Function to create debug manifest
function createDebugManifest() {
    const debugDir = path.dirname(debugManifestPath);
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    fs.writeFileSync(debugManifestPath, debugManifestContent);
    console.log('✅ Fixed debug AndroidManifest.xml');
}

// Only run if android directory exists (i.e., during EAS build)
if (fs.existsSync(path.join(__dirname, '../android'))) {
    console.log('🔧 Applying Android configuration fixes...');
    fixMainManifest();
    fixGradleProperties();
    fixAppBuildGradle();
    createDebugManifest();
    console.log('🎉 All Android fixes applied!');
} else {
    console.log('📱 Android directory not found, skipping fixes');
}