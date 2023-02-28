import add, { print } from '@/index'
// 文档： https://www.jestjs.cn/docs/api

describe('套件', () => {
  test('add(2 + 2) 等于 4', () => {
    expect(add(2, 2)).toBe(4)
  })
  
  test('测试 print 是否打印', () => {
    console.log = jest.fn();
    print(2)
    print(3)
    expect(console.log).toHaveBeenCalledWith(2);
    expect(console.log).toHaveBeenCalledWith(3);
  })
})
