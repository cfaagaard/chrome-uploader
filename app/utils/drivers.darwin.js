/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

import { remote } from 'electron';
import plist from 'plist';
import fs from 'fs';
import path from 'path';
import isDev from 'electron-is-dev';
import decompress from 'decompress';
import * as sync from '../actions/sync';

export function checkVersion(dispatch) {

  dispatch(sync.checkingForDriverUpdate());

  function setInstallOpts(iconsPath, scriptPath, extractPath) {
    const options = {
      name: 'Tidepool Driver Installer',
      icns: iconsPath
    };
    const execString = scriptPath.replace(/ /g, '\\ ') + ' ' + extractPath.replace(/ /g, '\\ ');
    dispatch(sync.driverUpdateShellOpts({options,execString}));
  }

  function readVersion(pListFile) {
    try {
      const list = plist.parse(fs.readFileSync(pListFile, 'utf8'));
      return list.CFBundleVersion;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 'Not found';
      } else {
        console.log(error);
      }
      return null;
    }
  }

  function hasOldDriver(dPath, driverList, installPath, pListFile) {
    let installedVersion, currentVersion;
    for (const driver of driverList) {
      if (pListFile === null) {
        currentVersion = readVersion(path.join(dPath, driver, driver + '.plist'));
        installedVersion = readVersion(path.join(installPath, driver + '.plist'));
      } else {
        currentVersion = readVersion(path.join(dPath, driver, pListFile));
        installedVersion = readVersion(path.join(installPath, driver, pListFile));
      }
      console.log(driver,'version: Installed =', installedVersion, ', Current =', currentVersion);

      if(currentVersion !== installedVersion) {
        dispatch(sync.driverUpdateAvailable(installedVersion, currentVersion));
        return true;
      }
    }
    dispatch(sync.driverUpdateNotAvailable(installedVersion));
    return false;
  }

  const appFolder = path.dirname(remote.app.getAppPath());
  let zipPath = path.join(appFolder, 'driver/extensions.zip');
  let extractPath = path.join(appFolder, 'driver/');
  let driverPath = path.join(extractPath, 'extensions');
  let helperPath = path.join(extractPath, 'helpers');
  let iconsPath = path.join(appFolder, '/Tidepool Uploader.icns');
  let scriptPath = path.join(appFolder, 'driver/updateDrivers.sh');

  if (isDev) {
    const rootDir = path.resolve(appFolder, '../../../../../../');
    zipPath = path.resolve(rootDir, 'resources/mac/extensions.zip');
    extractPath = path.resolve(rootDir, 'build/driver/');
    driverPath = path.join(extractPath, 'extensions');
    helperPath = path.join(extractPath, 'helpers');
    iconsPath = path.join(rootDir, 'resources/icon.icns');
    scriptPath = path.resolve(rootDir, 'resources/mac/updateDrivers.sh');
  }

  decompress(zipPath, extractPath).then(files => {
    const driverList = fs.readdirSync(driverPath).filter(e => path.extname(e) === '.kext' );
    const helperList = fs.readdirSync(helperPath).filter(e => e[0] !== '.');

    if (hasOldDriver(driverPath, driverList, '/Library/Extensions/', '/Contents/Info.plist') ||
      hasOldDriver(helperPath, helperList, '/Library/LaunchDaemons/', null)) {
      setInstallOpts(iconsPath, scriptPath, extractPath);
    }
  });

}
