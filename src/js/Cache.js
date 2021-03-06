/*
* @Cache: 本地缓存
* 缓存分为三部分:
* 1.GridData: 渲染表格时所使用的json数据 [存储在GM实例]
* 2.Cache: 核心缓存数据 [存储在DOM上]
* 3.UserMemory: 用户记忆 [存储在localStorage]
* */
import {jTool, Base} from './Base';
import {Settings, TextSettings} from './Settings';
import Checkbox from './Checkbox';
import Order from './Order';
import store from './Store';

class Cache {
    /**
     * 版本信息
     * @returns {*}
     */
    getVersion() {
        return store.version;
    }

    /**
     * 获取当前GM所在的域
     * @param $table
     * @returns {*}
     */
    getScope($table) {
        return store.scope[Base.getKey($table)];
    }

    /**
     * 存储当前GM所在的域, 当前
     * @param $table
     * @param scope
     */
    setScope($table, scope) {
        store.scope[Base.getKey($table)] = scope;
    }

    /**
     * 获取当前行使用的数据
     * @param $table 当前操作的grid,由插件自动传入
     * @param target 将要获取数据所对应的tr[Element or NodeList]
     * @returns {*}
     */
    getRowData($table, target) {
        const gmName = Base.getKey($table);
        if (!store.responseData[gmName]) {
            return;
        }
        // target type = Element 元素时, 返回单条数据对象;
        if (jTool.type(target) === 'element') {
            return store.responseData[gmName][target.getAttribute('cache-key')];
        } else if (jTool.type(target) === 'nodeList') {
            // target type =  NodeList 类型时, 返回数组
            let rodData = [];
            jTool.each(target, function (i, v) {
                rodData.push(store.responseData[gmName][v.getAttribute('cache-key')]);
            });
            return rodData;
        } else {
            // 不为Element NodeList时, 返回空对象
            return {};
        }
    }

    // TODO 暂时没有使用到，该方法可以处理双向数据变更后 GM对于数据的更新
    /**
     * 设置当前行使用的数据
     * @param $table
     * @param index
     * @param rowData
     */
    setRowData($table, index, rowData) {
        store.responseData[Base.getKey($table)][index] = rowData;
    }

    /**
     * 获取表格数据
     * @param $table
     */
    getTableData($table) {
        return store.responseData[Base.getKey($table)] || [];
    }

    /**
     * 存储表格数据
     * @param $table
     * @param data
     */
    setTableData($table, data) {
        const gmName = Base.getKey($table);
        if (!store.responseData[gmName]) {
            store.responseData[gmName] = {};
        }
        store.responseData[gmName] = data;
    }

    /**
     * 删除用户记忆
     * @param $table
     * @param cleanText
     * @returns {boolean}
     */
    delUserMemory($table, cleanText) {
        // 如果未指定删除的table, 则全部清除
        if (!$table || $table.length === 0) {
            window.localStorage.removeItem('GridManagerMemory');
            Base.outLog(`用户记忆被全部清除: ${cleanText}`, 'warn');
            return true;
        }

        // 指定table, 定点清除
        const settings = this.getSettings($table);
        Base.outLog(`${settings.gridManagerName}用户记忆被清除: ${cleanText}`, 'warn');

        let GridManagerMemory = window.localStorage.getItem('GridManagerMemory');
        if (!GridManagerMemory) {
            return false;
        }
        GridManagerMemory = JSON.parse(GridManagerMemory);

        // 指定删除的table, 则定点清除
        const _key = this.getMemoryKey(settings);
        delete GridManagerMemory[_key];

        // 清除后, 重新存储
        window.localStorage.setItem('GridManagerMemory', JSON.stringify(GridManagerMemory));
        return true;
    }

    /**
     * 获取表格的用户记忆标识码
     * @param settings
     * @returns {*}
     */
    getMemoryKey(settings) {
        return window.location.pathname + window.location.hash + '-' + settings.gridManagerName;
    }

    /**
     * 获取用户记忆
     * @param $table
     * @returns {*} 成功则返回本地存储数据,失败则返回空对象
     */
    getUserMemory($table) {
        if (!$table || $table.length === 0) {
            return {};
        }
        const _key = this.getMemoryKey(this.getSettings($table));
        if (!_key) {
            return {};
        }
        let GridManagerMemory = window.localStorage.getItem('GridManagerMemory');
        // 如无数据，增加属性标识：grid-manager-cache-error
        if (!GridManagerMemory || GridManagerMemory === '{}') {
            $table.attr('grid-manager-cache-error', 'error');
            return {};
        }
        GridManagerMemory = JSON.parse(GridManagerMemory);
        const _data = {
            key: _key,
            cache: JSON.parse(GridManagerMemory[_key] || '{}')
        };
        return _data;
    }

    /**
     * 存储用户记忆
     * @param $table
     * @param settings
     * @returns {boolean}
     */
    saveUserMemory($table, settings) {
        // 当前为禁用缓存模式，直接跳出
        if (settings.disableCache) {
            return false;
        }

        const thList = jTool('thead[grid-manager-thead] th', $table);
        if (!thList || thList.length === 0) {
            Base.outLog('saveUserMemory:无效的thList,请检查是否正确配置table,thead,th', 'error');
            return false;
        }

        let _cache = {};
        _cache.column = settings.columnMap;

        // 存储分页
        if (settings.supportAjaxPage) {
	        const _pageCache = {};
            _pageCache[settings.pageSizeKey] = settings.pageData[settings.pageSizeKey];
            _cache.page = _pageCache;
        }
        const cacheString = JSON.stringify(_cache);
        let GridManagerMemory = window.localStorage.getItem('GridManagerMemory');
        if (!GridManagerMemory) {
            GridManagerMemory = {};
        } else {
            GridManagerMemory = JSON.parse(GridManagerMemory);
        }
        GridManagerMemory[this.getMemoryKey(settings)] = cacheString;
        window.localStorage.setItem('GridManagerMemory', JSON.stringify(GridManagerMemory));
        return cacheString;
    }

    /**
     * 初始化设置相关: 合并, 存储
     * @param $table
     * @param arg
     */
    initSettings($table, arg) {
        // 合并参数
        const _settings = new Settings();
        _settings.textConfig = new TextSettings();
        jTool.extend(true, _settings, arg);

        // 存储初始配置项
        this.setSettings($table, _settings);

        // 为 columnData 增加 序号列
        if (_settings.supportAutoOrder) {
            _settings.columnData.unshift(Order.getColumn(_settings));
        }

        // 为 columnData 增加 选择列
        if (_settings.supportCheckbox) {
            _settings.columnData.unshift(Checkbox.getColumn(_settings));
        }

        // 为 columnData 提供锚 => columnMap
        // columnData 在此之后, 将不再被使用到
        // columnData 与 columnMap 已经过特殊处理, 不会彼此影响
        _settings.columnMap = {};
        _settings.columnData.forEach((col, index) => {
            _settings.columnMap[col.key] = col;

            // 如果未设定, 设置默认值为true
            _settings.columnMap[col.key].isShow = col.isShow || typeof (col.isShow) === 'undefined';

            // 为列Map 增加索引
            _settings.columnMap[col.key].index = index;
        });

	    // 合并用户记忆至 settings, 每页显示条数记忆不在此处
        const mergeUserMemory = () => {
            // 当前为禁用状态
            if (_settings.disableCache) {
                return;
            }

            const userMemory = this.getUserMemory($table);
            const columnCache = userMemory.cache && userMemory.cache.column ? userMemory.cache.column : {};
            const columnCacheKeys = Object.keys(columnCache);
            const columnMapKeys = Object.keys(_settings.columnMap);

            // 无用户记忆
            if (columnCacheKeys.length === 0) {
                return;
            }

            // 是否为有效的用户记忆
            let isUsable = true;

            // 与用户记忆数量不匹配
            if (columnCacheKeys.length !== columnMapKeys.length) {
                isUsable = false;
            }

            // 与用户记忆项不匹配
            isUsable && jTool.each(_settings.columnMap, (key, col) => {
	            if (!columnCache[key]
		            // 显示文本
		            || columnCache[key].text !== col.text

		            // 文本排列方向
		            || columnCache[key].align !== col.align

		            // 数据排序
		            || columnCache[key].sorting !== col.sorting

		            // 字段描述
	                || columnCache[key].remind !== col.remind

	                || JSON.stringify(columnCache[key].filter) !== JSON.stringify(col.filter)

		            // 字段模版
		            || (columnCache[key].template && columnCache[key].template !== col.template)) {
		            isUsable = false;
		            return false;
	            }
            });

            // 将用户记忆并入 columnMap 内
            if (isUsable) {
                jTool.extend(true, _settings.columnMap, columnCache);
            } else {
                // 清除用户记忆
                this.delUserMemory($table, '存储记忆项与配置项[columnData]不匹配');
            }
        };

        // 合并用户记忆
        mergeUserMemory();

        // 更新存储配置项
        this.setSettings($table, _settings);
        return _settings;
    }

    /**
     * 获取配置项
     * @param $table
     * @returns {*}
     */
    getSettings($table) {
        if (!$table || $table.length === 0) {
            return {};
        }
        // 返回的是 clone 对象 而非对象本身
        return jTool.extend(true, {}, store.settings[Base.getKey($table)] || {});
    }

    /**
     * 重置配置项
     * @param $table
     * @param settings
     */
    setSettings($table, settings) {
        store.settings[Base.getKey($table)] = jTool.extend(true, {}, settings);
    }

    /**
     * 更新Cache, 包含[更新表格列Map, 重置settings, 存储用户记忆]
     * @param $table
     * @param settings
     */
    update($table, settings) {
        if (!settings) {
            settings = this.getSettings($table);
        }
        // 更新表格列Map
        settings.columnMap = this.reworkColumnMap($table, settings.columnMap);

        // 重置settings
        this.setSettings($table, settings);

        // 存储用户记忆
        this.saveUserMemory($table, settings);
    }

    /**
     * 将 columnMap 返厂回修, 并返回最新的值, 适用操作[宽度调整, 位置调整, 可视状态调整]
     * @param $table
     * @param columnMap
     * @returns {*}
     */
    reworkColumnMap($table, columnMap) {
        // columnMap 为无效数据, 跳出
        if (!columnMap || jTool.isEmptyObject(columnMap)) {
            Base.outLog('columnMap 为无效数据', 'error');
            return;
        }
        let th = null;
        jTool.each(columnMap, (key, col) => {
            th = jTool(`thead[grid-manager-thead] th[th-name="${col.key}"]`, $table);
            // 宽度
            col.width = th.width() + 'px';

            // 位置索引
            col.index = th.index();

            // 可视状态
            col.isShow = th.attr('th-visible') === 'visible';
        });
        return columnMap;
    }

    /**
     * 验证版本号, 如果版本号变更清除用户记忆
     * @param $table
     * @param version 版本号
     */
    cleanTableCacheForVersion() {
        const cacheVersion = window.localStorage.getItem('GridManagerVersion');
        // 当前为第一次渲染
        if (!cacheVersion) {
            window.localStorage.setItem('GridManagerVersion', store.version);
        }
        // 版本变更, 清除所有的用户记忆
        if (cacheVersion && cacheVersion !== store.version) {
            this.delUserMemory(null, '版本已升级,原全部缓存被自动清除');
            window.localStorage.setItem('GridManagerVersion', store.version);
        }
    }
}

export default new Cache();
