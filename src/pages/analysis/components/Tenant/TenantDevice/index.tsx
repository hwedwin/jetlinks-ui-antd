import React, { useEffect, useState } from 'react';
import styles from '@/utils/table.less';
import { Card, Spin, Table, Tag, } from 'antd';
import { ColumnProps, PaginationConfig, SorterResult } from 'antd/lib/table';
import encodeQueryParam from '@/utils/encodeParam';
import apis from '@/services';
// import Search from './Search';
import { DeviceInstance } from '@/pages/device/instance/data.d';
import { DeviceProduct } from '@/pages/device/product/data';

import Service from "@/pages/system/tenant/service";
import { map, flatMap, toArray, groupBy, mergeMap, reduce, count, defaultIfEmpty } from "rxjs/operators";
import { from } from "rxjs";
import { randomString } from '@/utils/utils';


interface Props {

}

interface State {
  searchParam: any;
  productList: DeviceProduct[];
  deviceData: any;
}

const TenantDevice: React.FC<Props> = (props) => {
  const initState: State = {
    searchParam: {
      pageSize: 10, sorts: {
        order: "descend",
        field: "createTime"
      }
    },
    productList: [],
    deviceData: {},
  };

  const [searchParam, setSearchParam] = useState(initState.searchParam);
  const [deviceData, setDeviceData] = useState(initState.deviceData);
  const [spinning, setSpinning] = useState(true);

  const statusMap = new Map();
  statusMap.set('online', <Tag color="#87d068">在线</Tag>);
  statusMap.set('offline', <Tag color="#f50">离线</Tag>);
  statusMap.set('notActive', <Tag color="#1890ff">未激活</Tag>);

  const handleSearch = (params?: any) => {
    setSearchParam(params);
    apis.deviceInstance.list(encodeQueryParam(params))
      .then((response: any) => {
        if (response.status === 200) {
          setDeviceData(response.result);
        }
        setSpinning(false);
      })
      .catch(() => {
      })
  };

  const columns: ColumnProps<DeviceInstance>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: '90px',
      render: record => record ? statusMap.get(record.value) : '',
      filters: [
        {
          text: '未激活',
          value: 'notActive',
        },
        {
          text: '离线',
          value: 'offline',
        },
        {
          text: '在线',
          value: 'online',
        },
      ],
      filterMultiple: false,
    },
  ];

  useEffect(() => {
    handleSearch(searchParam);
  }, []);


  const onTableChange = (
    pagination: PaginationConfig,
    filters: any,
    sorter: SorterResult<DeviceInstance>,) => {
    setSpinning(true);
    let { terms } = searchParam;
    if (filters.state) {
      if (terms) {
        terms.state = filters.state[0];
      } else {
        terms = {
          state: filters.state[0],
        };
      }
    }
    handleSearch({
      pageIndex: Number(pagination.current) - 1,
      pageSize: pagination.pageSize,
      terms,
      sorts: sorter,
    });
  };


  const service = new Service('');
  const [data, setData] = useState<any[]>([]);

  const user = JSON.parse(localStorage.getItem('hsweb-autz') || '{}');

  const tenantId = user?.user.tenants.filter((i: any) => i.mainTenant)[0].tenantId;
  const userId = user?.userId;
  const tenantAdmin = user?.user.tenants.filter((i: any) => i.mainTenant)[0].adminMember;

  useEffect(() => {
    // todo 查询租户
    service.member.queryNoPaging(tenantId, {})
      .pipe(// 
        flatMap(from),
        flatMap((i: any) => service.assets.productNopaging(encodeQueryParam({
          terms: {
            id$assets: JSON.stringify({
              tenantId: tenantId,
              assetType: 'product',
              memberId: i.userId,
            }),
          }
        })).pipe(
          flatMap(from),
          flatMap((t: any) => {
            return service.assets.instanceNopaging(
              encodeQueryParam({
                terms: {
                  productId: t.id,
                  id$assets: JSON.stringify({
                    tenantId: tenantId,
                    assetType: 'device',
                    memberId: i.userId,
                  }),
                }
              })).pipe(
                // filter(item => item.length > 0),
                flatMap(from),
                groupBy(item => item.state.value),
                mergeMap(val$ => val$.pipe(
                  count(),
                  map(count => {
                    let v = { productId: t.id, productName: t.name };
                    v[val$.key] = count;
                    return v;
                  })
                )),
                defaultIfEmpty({ productId: t.id, productName: t.name }),
                groupBy(j => j.productId),
                flatMap(group => group.pipe(
                  reduce((a, b) => ({ ...a, ...b }))
                ))
              )
          }),
          //product 为list
          // toArray(),
          // map(a => ({ userId: i.userId, name: i.name, product: a })),
          // 平铺product
          map(a => ({ userId: i.userId, name: i.name, ...a, key: `${i.userId}-${randomString(7)}` })),
          defaultIfEmpty({ userId: i.userId, name: i.name, key: `${i.userId}` })
        )),
        toArray(),
        map(list => list.sort((a, b) => a.userId - b.userId))
      ).subscribe((result) => {
        setData(result);
        if (tenantAdmin) {
          setData(result);
        } else {
          const temp = result.filter(i => i.userId === userId);
          setData(temp);
        }
        // console.log(tenantAdmin, 'rrr');
        // console.log(JSON.stringify(result), 'result');
      });

    apis.deviceInstance.count({})

  }, []);

  const test: string[] = [];

  const columns2 = [
    {
      title: '成员',
      dataIndex: 'name',
      render: (text, row, index) => {
        test.push(text);
        return {
          children: text,
          props: {
            rowSpan: test.filter(i => i === text).length > 1 ? 0 : data.filter(i => i.name === text).length,
          },
        };
      },
    },
    {
      title: '产品',
      dataIndex: 'productName',
      // render: renderContent,
    },
    {
      title: '设备在线',
      // colSpan: 2,
      dataIndex: 'online',
      render: (text: any) => text || 0,
      // render: (value, row, index) => {
      //     const obj = {
      //         children: value,
      //         props: {
      //             // rowSpan: 0,
      //         },
      //     };
      //     if (index === 2) {
      //         obj.props.rowSpan = 2;
      //     }
      //     // These two are merged into above cell
      //     if (index === 3) {
      //         obj.props.rowSpan = 0;
      //     }
      //     if (index === 4) {
      //         obj.props.colSpan = 0;
      //     }
      //     return obj;
      // },
    },
    {
      title: '设备离线',
      // colSpan: 0,
      dataIndex: 'offline',
      render: (text: any) => text || 0,
    },
    {
      dataIndex: 'log',
      title: '告警记录',
      render: (text: any) => text || 0,
    },
  ];


  return (
    <Spin spinning={spinning}>
      <Card bordered={false}>
        <div className={styles.tableList}>
          <div className={styles.tableListForm}>
            {/* <Search
              search={(params: any) => {
                setSpinning(true);
                params.state = searchParam.terms?.state;
                handleSearch({ terms: params, pageSize: 10, sorts: searchParam.sorts });
              }}
            /> */}
          </div>
          <div className={styles.StandardTable} style={{ marginTop: 10 }}>
            {/* <Table
              size='middle'
              columns={columns}
              dataSource={(deviceData || {}).data}
              rowKey="id"
              onChange={onTableChange}
              pagination={{
                current: deviceData.pageIndex + 1,
                total: deviceData.total,
                pageSize: deviceData.pageSize,
              }}
            /> */}
            <Table
              size="small"
              pagination={false}
              columns={tenantAdmin ? columns2 : columns2.filter(i => i.dataIndex !== 'name')}
              dataSource={data}
              bordered />
          </div>
        </div>
      </Card>
    </Spin>
  );
};

export default TenantDevice;
