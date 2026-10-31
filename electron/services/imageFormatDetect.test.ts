import { describe, expect, it } from 'vitest'
import { ImageDecryptService } from './imageDecryptService'

/**
 * 解密产物只有认得出格式才会落盘，`detectImageExtension` 返回 null 就等于"解密失败"。
 * iPhone 原图（HEIC/HEIF，ISO-BMFF 封装）以前不在识别表里：密钥是对的、AES 也解开了，
 * 却被报成"解密后不是有效图片 → 密钥可能属于另一个账号"，把人一路误导到重取密钥上去。
 * 现在认 heic/avif，但不能把 mp4（`isom`）这类视频封装也认成图片。
 */

function bmff(brand: string): Buffer {
  const buffer = Buffer.alloc(24)
  buffer.writeUInt32LE(24, 0)
  buffer.write('ftyp', 4, 'latin1')
  buffer.write(brand, 8, 'latin1')
  return buffer
}

type Internals = {
  detectImageExtension: (buffer: Buffer) => string | null
  mimeFromExtension: (ext: string) => string | null
}

function internals(): Internals {
  return new ImageDecryptService() as unknown as Internals
}

describe('detectImageExtension — ISO-BMFF 图片要认，视频封装不能误认', () => {
  it.each([
    ['heic', '.heic'],
    ['heix', '.heic'],
    ['mif1', '.heic'],
    ['avif', '.avif'],
    ['avis', '.avif'],
  ])('%s → %s', (brand, expected) => {
    expect(internals().detectImageExtension(bmff(brand))).toBe(expected)
  })

  it.each(['isom', 'mp41', 'MSVX', 'qt  '])('%s 不是图片', (brand) => {
    expect(internals().detectImageExtension(bmff(brand))).toBeNull()
  })

  it('常规格式照旧，短缓冲不抛', () => {
    const service = internals()
    expect(service.detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('.jpg')
    expect(service.detectImageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('.png')
    expect(service.detectImageExtension(Buffer.from([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('.gif')
    expect(service.detectImageExtension(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('.webp')
    expect(service.detectImageExtension(Buffer.from([0x00, 0x00]))).toBeNull()
  })
})

describe('mimeFromExtension — 预览与 data URL 需要认得新扩展名', () => {
  it('heic/avif 有 MIME，未知扩展名返回 null', () => {
    const service = internals()
    expect(service.mimeFromExtension('.heic')).toBe('image/heic')
    expect(service.mimeFromExtension('.avif')).toBe('image/avif')
    expect(service.mimeFromExtension('.xyz')).toBeNull()
  })
})
